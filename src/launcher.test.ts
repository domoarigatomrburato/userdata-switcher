import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import { resolveEditorHost } from "./host";
import {
  buildLaunchCommand,
  discoverBundledCli,
  discoverEditorCli,
  launchEditor,
  resolveWorkspaceArg,
} from "./launcher";
import type { UserdataEntry } from "./registry";

const cursor = resolveEditorHost({ appName: "Cursor", uriScheme: "cursor" });
const vscode = resolveEditorHost({
  appName: "Visual Studio Code",
  uriScheme: "vscode",
});
const insiders = resolveEditorHost({
  appName: "Visual Studio Code - Insiders",
  uriScheme: "vscode-insiders",
});
assert.ok(cursor);
assert.ok(vscode);
assert.ok(insiders);

describe("discoverBundledCli", () => {
  it("finds the bundled cursor CLI under appRoot", () => {
    assert.equal(
      discoverBundledCli(
        cursor,
        "/Applications/Cursor.app/Contents/Resources/app",
        {
          existsSync: (candidate) => candidate.endsWith("/bin/cursor"),
          platform: "darwin",
        },
      ),
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    );
  });

  it("finds the bundled VS Code CLI under appRoot", () => {
    assert.equal(
      discoverBundledCli(
        vscode,
        "/Applications/Visual Studio Code.app/Contents/Resources/app",
        {
          existsSync: (candidate) => candidate.endsWith("/bin/code"),
          platform: "darwin",
        },
      ),
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    );
  });

  it("finds a bundled Windows CLI with PATHEXT", () => {
    assert.equal(
      discoverBundledCli(
        insiders,
        "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\resources\\app",
        {
          existsSync: (candidate) =>
            candidate.endsWith("\\bin\\code-insiders.cmd"),
          platform: "win32",
        },
      ),
      "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\resources\\app\\bin\\code-insiders.cmd",
    );
  });
});

describe("discoverEditorCli", () => {
  it("prefers the bundled editor CLI under appRoot", () => {
    assert.equal(
      discoverEditorCli(
        cursor,
        "/Applications/Cursor.app/Contents/Resources/app",
        {
          env: { PATH: "/usr/local/bin" },
          existsSync: (candidate) => candidate.endsWith("/bin/cursor"),
          platform: "darwin",
        },
      ),
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    );
  });

  it("falls back to the host CLI on PATH when the bundled CLI is unavailable", () => {
    assert.equal(
      discoverEditorCli(vscode, "/missing/Code.app/Contents/Resources/app", {
        env: { PATH: "/usr/local/bin:/opt/bin" },
        existsSync: (candidate) => candidate === "/opt/bin/code",
        platform: "darwin",
      }),
      "/opt/bin/code",
    );
  });
});

describe("resolveWorkspaceArg", () => {
  it("returns a single-folder workspace path", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFolders: [{ uri: { fsPath: "/repo" } }],
      }),
      "/repo",
    );
  });

  it("returns a saved workspace file path", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFile: { fsPath: "/repo/project.code-workspace" },
      }),
      "/repo/project.code-workspace",
    );
  });

  it("returns undefined for untitled multi-root workspaces", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFolders: [
          { uri: { fsPath: "/a" } },
          { uri: { fsPath: "/b" } },
        ],
      }),
      undefined,
    );
  });
});

describe("buildLaunchCommand", () => {
  const managed: UserdataEntry = {
    id: "personal",
    kind: "managed",
    label: "Personal",
    relativeDataDir: "userdata/personal/data",
  };

  it("launches managed userdata with --user-data-dir", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managed,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
      }),
      {
        command: "/app/bin/code",
        args: ["--user-data-dir", "/store/userdata/personal/data", "/repo"],
      },
    );
  });

  it("omits --user-data-dir for default userdata", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: { id: "default", kind: "default", label: "Work" },
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
      }),
      {
        command: "/app/bin/code",
        args: ["/repo"],
      },
    );
  });

  it("never adds --reuse-window without --user-data-dir", () => {
    const launch = buildLaunchCommand({
      entry: { id: "default", kind: "default", label: "Work" },
      storeRoot: "/store",
      workspacePath: "/repo",
      editorCli: "/app/bin/code",
      reuseWindow: true,
    });
    assert.deepEqual(launch.args, ["/repo"]);
  });
});

describe("launchEditor", () => {
  it("resolves after the editor process is spawned", async () => {
    let unrefCalled = false;
    const child = new EventEmitter() as EventEmitter & { unref(): void };
    child.unref = () => {
      unrefCalled = true;
    };

    const launched = launchEditor(
      { command: process.execPath, args: ["-e", ""] },
      {
        spawn: () => child,
      },
    );

    child.emit("spawn");

    await launched;
    assert.equal(unrefCalled, true);
  });

  it("rejects when the editor process cannot be spawned", async () => {
    const child = new EventEmitter() as EventEmitter & { unref(): void };
    child.unref = () => {};

    const launched = launchEditor(
      { command: process.execPath, args: ["-e", ""] },
      {
        spawn: () => child,
      },
    );
    assert.ok(launched instanceof Promise);

    const error = new Error("spawn editor ENOENT");
    child.emit("error", error);

    await assert.rejects(launched, error);
  });
});
