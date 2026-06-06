import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildLaunchCommand,
  discoverBundledCli,
  resolveWorkspaceArg,
} from "../src/launcher";
import type { UserdataEntry } from "../src/registry";

describe("discoverBundledCli", () => {
  it("finds the bundled cursor CLI under appRoot", () => {
    assert.equal(
      discoverBundledCli("/Applications/Cursor.app/Contents/Resources/app", {
        existsSync: (candidate) => candidate.endsWith("/bin/cursor"),
      }),
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
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
        workspaceFolders: [{ uri: { fsPath: "/a" } }, { uri: { fsPath: "/b" } }],
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
        bundledCli: "/app/bin/cursor",
      }),
      {
        command: "/app/bin/cursor",
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
        bundledCli: "/app/bin/cursor",
      }),
      {
        command: "/app/bin/cursor",
        args: ["/repo"],
      },
    );
  });

  it("never adds --reuse-window without --user-data-dir", () => {
    const launch = buildLaunchCommand({
      entry: { id: "default", kind: "default", label: "Work" },
      storeRoot: "/store",
      workspacePath: "/repo",
      bundledCli: "/app/bin/cursor",
      reuseWindow: true,
    });
    assert.deepEqual(launch.args, ["/repo"]);
  });
});
