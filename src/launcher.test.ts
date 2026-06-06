import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";
import type { SupportedHostAdapter } from "./host";
import {
  buildLaunchCommand,
  buildOpenWithUserdataCommand,
  launchEditor,
  openWithUserdata,
  resolveWorkspaceArg,
} from "./launcher";
import type { UserdataEntry } from "./registry";

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

  it("adds --extensions-dir for managed userdata when provided", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managed,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
        sharedExtensionsDirectory: "/Users/alice/.vscode/extensions",
      }),
      {
        command: "/app/bin/code",
        args: [
          "--user-data-dir",
          "/store/userdata/personal/data",
          "--extensions-dir",
          "/Users/alice/.vscode/extensions",
          "/repo",
        ],
      },
    );
  });

  it("omits --extensions-dir when shared extensions directory is not provided", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managed,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
        sharedExtensionsDirectory: null,
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
        sharedExtensionsDirectory: "/Users/alice/.vscode/extensions",
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

describe("buildOpenWithUserdataCommand", () => {
  const managed: UserdataEntry = {
    id: "personal",
    kind: "managed",
    label: "Personal",
    relativeDataDir: "userdata/personal/data",
  };

  const host: SupportedHostAdapter = {
    id: "vscode",
    displayName: "Visual Studio Code",
    cliNames: ["code"],
    resolveStoreRoot: () => "/store",
    resolveDefaultUserdataRoot: () => "/default-userdata",
    resolveSharedExtensionsDirectory: () => "/home/alice/.vscode/extensions",
    discoverBundledCli: () => "/app/bin/code",
    discoverEditorCli: () => "/app/bin/code",
  };

  it("builds the managed userdata launch from host and workspace policy", () => {
    assert.deepEqual(
      buildOpenWithUserdataCommand({
        entry: managed,
        host,
        appRoot: "/app",
        storeRoot: "/store",
        workspace: {
          workspaceFolders: [{ uri: { fsPath: "/repo" } }],
        },
      }),
      {
        command: "/app/bin/code",
        args: [
          "--user-data-dir",
          "/store/userdata/personal/data",
          "--extensions-dir",
          "/home/alice/.vscode/extensions",
          "--reuse-window",
          "/repo",
        ],
      },
    );
  });

  it("builds the default userdata launch without userdata flags", () => {
    assert.deepEqual(
      buildOpenWithUserdataCommand({
        entry: { id: "default", kind: "default", label: "Work" },
        host,
        appRoot: "/app",
        storeRoot: "/store",
        workspace: {
          workspaceFolders: [{ uri: { fsPath: "/repo" } }],
        },
      }),
      {
        command: "/app/bin/code",
        args: ["/repo"],
      },
    );
  });

  it("throws a host-specific error when no editor CLI is available", () => {
    assert.throws(
      () =>
        buildOpenWithUserdataCommand({
          entry: managed,
          host: {
            ...host,
            discoverEditorCli: () => null,
          },
          appRoot: "/missing-app",
          storeRoot: "/store",
          workspace: {},
        }),
      /Could not find Visual Studio Code CLI in this installation\./,
    );
  });
});

describe("openWithUserdata", () => {
  it("launches the command built from the selected userdata", async () => {
    const launched: unknown[] = [];

    await openWithUserdata({
      entry: {
        id: "default",
        kind: "default",
        label: "Work",
      },
      host: {
        id: "vscode",
        displayName: "Visual Studio Code",
        cliNames: ["code"],
        resolveStoreRoot: () => "/store",
        resolveDefaultUserdataRoot: () => "/default-userdata",
        resolveSharedExtensionsDirectory: () =>
          "/home/alice/.vscode/extensions",
        discoverBundledCli: () => "/app/bin/code",
        discoverEditorCli: () => "/app/bin/code",
      },
      appRoot: "/app",
      storeRoot: "/store",
      workspace: {
        workspaceFolders: [{ uri: { fsPath: "/repo" } }],
      },
      launchEditorImpl: async (command) => {
        launched.push(command);
      },
    });

    assert.deepEqual(launched, [{ command: "/app/bin/code", args: ["/repo"] }]);
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
