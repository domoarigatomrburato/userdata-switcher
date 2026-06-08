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
  sanitizeEditorLaunchEnvironment,
} from "./launcher";
import type { UserdataEntry } from "./registry";

const managedEntry: UserdataEntry = {
  id: "personal",
  kind: "managed",
  label: "Personal",
  relativeDataDir: "u/personal",
};

const vscodeHost: SupportedHostAdapter = {
  id: "vscode",
  displayName: "Visual Studio Code",
  cliNames: ["code"],
  resolveStoreRoot: () => "/store",
  resolveDefaultUserdataRoot: () => "/default-userdata",
  resolveSharedExtensionsDirectory: () => "/home/alice/.vscode/extensions",
  discoverBundledCli: () => "/app/bin/code",
  discoverEditorCli: () => "/app/bin/code",
};

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
  it("launches managed userdata with --user-data-dir", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managedEntry,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
      }),
      {
        command: "/app/bin/code",
        args: ["--user-data-dir", "/store/u/personal", "/repo"],
      },
    );
  });

  it("adds --extensions-dir for managed userdata when provided", () => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managedEntry,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
        sharedExtensionsDirectory: "/Users/alice/.vscode/extensions",
      }),
      {
        command: "/app/bin/code",
        args: [
          "--user-data-dir",
          "/store/u/personal",
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
        entry: managedEntry,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
        sharedExtensionsDirectory: null,
      }),
      {
        command: "/app/bin/code",
        args: ["--user-data-dir", "/store/u/personal", "/repo"],
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

  it("does not force reuse for managed userdata", () => {
    const launch = buildLaunchCommand({
      entry: managedEntry,
      storeRoot: "/store",
      workspacePath: "/repo",
      editorCli: "/app/bin/code",
    });
    assert.deepEqual(launch.args, [
      "--user-data-dir",
      "/store/u/personal",
      "/repo",
    ]);
  });
});

describe("buildOpenWithUserdataCommand", () => {
  it("builds the managed userdata launch from host and workspace policy", () => {
    const logs: string[] = [];
    assert.deepEqual(
      buildOpenWithUserdataCommand({
        entry: managedEntry,
        host: vscodeHost,
        appRoot: "/app",
        storeRoot: "/store",
        workspace: {
          workspaceFolders: [{ uri: { fsPath: "/repo" } }],
        },
        logger: {
          error: (message) => logs.push(`error:${message}`),
          info: (message) => logs.push(`info:${message}`),
        },
      }),
      {
        command: "/app/bin/code",
        args: [
          "--user-data-dir",
          "/store/u/personal",
          "--extensions-dir",
          "/home/alice/.vscode/extensions",
          "/repo",
        ],
      },
    );
    if (process.platform === "darwin") {
      assert.deepEqual(logs, [
        "info:macOS socket path length=32/103: /store/u/personal/1.12-main.sock",
      ]);
    }
  });

  it("rejects macOS managed launches whose socket path would be too long", () => {
    const logs: string[] = [];
    const build = () =>
      buildOpenWithUserdataCommand({
        entry: managedEntry,
        host: vscodeHost,
        appRoot: "/app",
        storeRoot:
          "/Users/alessandroburato/Library/Application Support/Userdata Switcher/Visual Studio Code",
        workspace: {},
        logger: {
          error: (message) => logs.push(`error:${message}`),
          info: (message) => logs.push(`info:${message}`),
        },
      });

    if (process.platform === "darwin") {
      assert.throws(
        build,
        /Managed userdata path is too long for Visual Studio Code on macOS/,
      );
      assert.deepEqual(logs, [
        "info:macOS socket path length=114/103: /Users/alessandroburato/Library/Application Support/Userdata Switcher/Visual Studio Code/u/personal/1.12-main.sock",
      ]);
    } else {
      assert.doesNotThrow(build);
      assert.deepEqual(logs, []);
    }
  });

  it("builds the default userdata launch without userdata flags", () => {
    assert.deepEqual(
      buildOpenWithUserdataCommand({
        entry: { id: "default", kind: "default", label: "Work" },
        host: vscodeHost,
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
          entry: managedEntry,
          host: {
            ...vscodeHost,
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

  it("spawns the editor CLI with sanitized VS Code process environment", async () => {
    let unrefCalled = false;
    let spawnOptions: { env: NodeJS.ProcessEnv } | undefined;
    const logs: string[] = [];
    const stdout = new EventEmitter();
    const stderr = new EventEmitter();
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      stdout: EventEmitter;
      unref(): void;
    };
    child.stdout = stdout;
    child.stderr = stderr;
    child.unref = () => {
      unrefCalled = true;
    };

    const launched = launchEditor(
      { command: process.execPath, args: ["--version"] },
      {
        env: {
          ELECTRON_RUN_AS_NODE: "1",
          PATH: "/usr/bin",
          VSCODE_IPC_HOOK_CLI: "/tmp/current.sock",
          VSCODE_PORTABLE: "/portable",
        },
        spawn: (_command, _args, options) => {
          spawnOptions = options;
          return child;
        },
      },
      {
        logger: {
          error: (message) => logs.push(`error:${message}`),
          info: (message) => logs.push(`info:${message}`),
        },
      },
    );

    child.emit("spawn");
    stdout.emit("data", "hello\n");
    stderr.emit("data", Buffer.from("warning\n"));
    child.emit("exit", 0, null);
    child.emit("close", 0, null);

    await launched;

    assert.equal(unrefCalled, true);
    assert.equal(spawnOptions?.env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(spawnOptions?.env.VSCODE_IPC_HOOK_CLI, undefined);
    assert.equal(spawnOptions?.env.PATH, "/usr/bin");
    assert.equal(spawnOptions?.env.VSCODE_PORTABLE, "/portable");
    assert.deepEqual(logs, [
      "info:Launch environment sanitized; removed ELECTRON_RUN_AS_NODE, VSCODE_IPC_HOOK_CLI",
      "info:Editor CLI spawned successfully",
      "info:Editor CLI stdout: hello",
      "info:Editor CLI stderr: warning",
      "info:Editor CLI exit event: code=0 signal=null",
      "info:Editor CLI close event: code=0 signal=null",
    ]);
  });
});

describe("sanitizeEditorLaunchEnvironment", () => {
  it("removes editor process markers while preserving portable and shell environment", () => {
    assert.deepEqual(
      sanitizeEditorLaunchEnvironment({
        ELECTRON_RUN_AS_NODE: "1",
        HOME: "/home/alice",
        VSCODE_ENV_APPEND: "keep",
        VSCODE_IPC_HOOK_CLI: "/tmp/current.sock",
        VSCODE_PORTABLE: "/portable",
        VSCODE_SHELL_LOGIN: "1",
      }),
      {
        env: {
          HOME: "/home/alice",
          VSCODE_ENV_APPEND: "keep",
          VSCODE_PORTABLE: "/portable",
          VSCODE_SHELL_LOGIN: "1",
        },
        removedKeys: ["ELECTRON_RUN_AS_NODE", "VSCODE_IPC_HOOK_CLI"],
      },
    );
  });
});
