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
  discoverEditorCli: () => "/app/bin/code",
};

const createTestLogger = () => {
  const logs: string[] = [];
  return {
    logs,
    logger: {
      error: (message: string) => logs.push(`error:${message}`),
      info: (message: string) => logs.push(`info:${message}`),
    },
  };
};

describe("resolveWorkspaceArg", () => {
  it("returns a single-folder workspace path", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFolders: [{ uri: { fsPath: "/repo", scheme: "file" } }],
      }),
      "/repo",
    );
  });

  it("returns undefined for non-file single-folder workspaces", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFolders: [
          { uri: { fsPath: "/repo", scheme: "vscode-remote" } },
        ],
      }),
      undefined,
    );
  });

  it("returns a saved workspace file path", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFile: {
          fsPath: "/repo/project.code-workspace",
          scheme: "file",
        },
      }),
      "/repo/project.code-workspace",
    );
  });

  it("returns undefined for untitled workspace files", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFile: {
          fsPath: "/Untitled-1.code-workspace",
          scheme: "untitled",
        },
        workspaceFolders: [
          { uri: { fsPath: "/a", scheme: "file" } },
          { uri: { fsPath: "/b", scheme: "file" } },
        ],
      }),
      undefined,
    );
  });

  it("returns undefined for untitled multi-root workspaces", () => {
    assert.equal(
      resolveWorkspaceArg({
        workspaceFolders: [
          { uri: { fsPath: "/a", scheme: "file" } },
          { uri: { fsPath: "/b", scheme: "file" } },
        ],
      }),
      undefined,
    );
  });
});

describe("buildLaunchCommand", () => {
  const assertLaunchCommand = (
    options: Partial<Parameters<typeof buildLaunchCommand>[0]>,
    expectedArgs: string[],
  ) => {
    assert.deepEqual(
      buildLaunchCommand({
        entry: managedEntry,
        storeRoot: "/store",
        workspacePath: "/repo",
        editorCli: "/app/bin/code",
        ...options,
      }),
      {
        command: "/app/bin/code",
        args: expectedArgs,
      },
    );
  };

  it("launches managed userdata with --user-data-dir", () => {
    assertLaunchCommand({}, ["--user-data-dir", "/store/u/personal", "/repo"]);
  });

  it("adds --extensions-dir for managed userdata when provided", () => {
    assertLaunchCommand(
      { sharedExtensionsDirectory: "/Users/alice/.vscode/extensions" },
      [
        "--user-data-dir",
        "/store/u/personal",
        "--extensions-dir",
        "/Users/alice/.vscode/extensions",
        "/repo",
      ],
    );
  });

  it("omits --extensions-dir when shared extensions directory is not provided", () => {
    assertLaunchCommand({ sharedExtensionsDirectory: null }, [
      "--user-data-dir",
      "/store/u/personal",
      "/repo",
    ]);
  });

  it("omits --user-data-dir for default userdata", () => {
    assertLaunchCommand(
      {
        entry: { id: "default", kind: "default", label: "Work" },
        sharedExtensionsDirectory: "/Users/alice/.vscode/extensions",
      },
      ["/repo"],
    );
  });

  it("does not force reuse for managed userdata", () => {
    assertLaunchCommand({}, ["--user-data-dir", "/store/u/personal", "/repo"]);
  });
});

describe("buildOpenWithUserdataCommand", () => {
  it("builds the managed userdata launch from host and workspace policy", () => {
    const { logs, logger } = createTestLogger();
    assert.deepEqual(
      buildOpenWithUserdataCommand({
        entry: managedEntry,
        host: vscodeHost,
        appRoot: "/app",
        storeRoot: "/store",
        workspace: {
          workspaceFolders: [{ uri: { fsPath: "/repo" } }],
        },
        logger,
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
    const { logs, logger } = createTestLogger();
    const build = () =>
      buildOpenWithUserdataCommand({
        entry: managedEntry,
        host: vscodeHost,
        appRoot: "/app",
        storeRoot:
          "/Users/alessandroburato/Library/Application Support/Userdata Switcher/Visual Studio Code",
        workspace: {},
        logger,
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
    let spawnOptions:
      | {
          env: NodeJS.ProcessEnv;
          stdio: ["ignore", "ignore", "ignore"];
        }
      | undefined;
    const { logs, logger } = createTestLogger();
    const child = new EventEmitter() as EventEmitter & {
      pid: number;
      unref(): void;
    };
    child.pid = 4321;
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
        logger,
      },
    );

    child.emit("spawn");
    await launched;

    assert.equal(unrefCalled, true);
    assert.deepEqual(spawnOptions?.stdio, ["ignore", "ignore", "ignore"]);
    assert.equal(spawnOptions?.env.ELECTRON_RUN_AS_NODE, undefined);
    assert.equal(spawnOptions?.env.VSCODE_IPC_HOOK_CLI, undefined);
    assert.equal(spawnOptions?.env.PATH, "/usr/bin");
    assert.equal(spawnOptions?.env.VSCODE_PORTABLE, "/portable");
    assert.deepEqual(logs, [
      "info:Launch environment sanitized; removed ELECTRON_RUN_AS_NODE, VSCODE_IPC_HOOK_CLI",
      "info:Editor CLI spawned successfully (pid=4321)",
    ]);
  });

  it("spawns Windows command shims through cmd.exe", async () => {
    let spawnCommand: string | undefined;
    let spawnArgs: string[] | undefined;
    const child = new EventEmitter() as EventEmitter & { unref(): void };
    child.unref = () => {};

    const launched = launchEditor(
      {
        command: "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
        args: [
          "--user-data-dir",
          "C:\\Users\\ale\\AppData\\Local\\udsw\\vscode\\u\\provona",
        ],
      },
      {
        platform: "win32",
        spawn: (command, args) => {
          spawnCommand = command;
          spawnArgs = args;
          return child;
        },
      },
    );

    child.emit("spawn");
    await launched;

    assert.equal(spawnCommand, "cmd.exe");
    assert.deepEqual(spawnArgs, [
      "/d",
      "/c",
      "call",
      "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
      "--user-data-dir",
      "C:\\Users\\ale\\AppData\\Local\\udsw\\vscode\\u\\provona",
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
