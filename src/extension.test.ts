import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  activateUserdataSwitcher,
  COMMAND_CREATE_USERDATA,
  COMMAND_OPEN_WITH_USERDATA,
  COMMAND_RENAME_CURRENT_USERDATA,
  COMMAND_SHOW_CURRENT_USERDATA,
  type QuickPickItem,
  type StatusBarItem,
  type UserdataSwitcherActivation,
  type UserdataSwitcherUi,
} from "./extensionActivation";
import type { SupportedHostAdapter } from "./host";
import type { LaunchCommand } from "./launcher";
import { CREATE_USERDATA_LABEL, RENAME_CURRENT_USERDATA_LABEL } from "./menu";
import { loadRegistry, saveRegistry } from "./registry";

interface TestHarness {
  tempDir: string;
  storeRoot: string;
  defaultUserdataRoot: string;
  sharedExtensionsDirectory: string;
  host: SupportedHostAdapter;
  statusBar: StatusBarItem;
  commands: Map<string, (...args: unknown[]) => unknown>;
  launched: LaunchCommand[];
  createdDirs: string[];
  errors: string[];
  warnings: string[];
  infos: string[];
  logs: string[];
  quickPickItems: readonly QuickPickItem[][];
  quickPickSelection: QuickPickItem | undefined;
  inputBoxValue: string | undefined;
  activation: UserdataSwitcherActivation;
  run(command: string): Promise<unknown>;
}

function createTestHarness(input?: {
  globalStoragePath?: string;
  discoverEditorCli?: SupportedHostAdapter["discoverEditorCli"];
  quickPickSelection?: QuickPickItem;
  inputBoxValue?: string;
}): TestHarness {
  const tempRoot = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const tempDir = fs.mkdtempSync(
    path.join(tempRoot, "userdata-switcher-extension-test-"),
  );
  const storeRoot = path.join(tempDir, "store");
  const defaultUserdataRoot = path.join(tempDir, "default-userdata");
  const sharedExtensionsDirectory = path.join(tempDir, "shared-extensions");
  const globalStoragePath =
    input?.globalStoragePath ??
    path.join(
      defaultUserdataRoot,
      "User",
      "globalStorage",
      "publisher.ext",
      "globalStorage",
    );

  const statusBar: StatusBarItem = {
    text: "",
    tooltip: "",
    command: "",
    show() {},
  };
  const commands = new Map<string, (...args: unknown[]) => unknown>();
  const launched: LaunchCommand[] = [];
  const createdDirs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];
  const logs: string[] = [];
  const quickPickItems: QuickPickItem[][] = [];

  const host: SupportedHostAdapter = {
    id: "cursor",
    displayName: "Cursor",
    cliNames: ["cursor"],
    resolveStoreRoot: () => storeRoot,
    resolveDefaultUserdataRoot: () => defaultUserdataRoot,
    resolveSharedExtensionsDirectory: () => sharedExtensionsDirectory,
    discoverBundledCli: () => "/app/bin/cursor",
    discoverEditorCli: input?.discoverEditorCli ?? (() => "/app/bin/cursor"),
  };

  const ui: UserdataSwitcherUi = {
    StatusBarAlignment: { Left: 1 },
    QuickPickItemKind: { Separator: -1 },
    createStatusBarItem: () => statusBar,
    registerCommand: (command, callback) => {
      commands.set(command, callback);
      return { dispose: () => commands.delete(command) };
    },
    showQuickPick: async (items) => {
      quickPickItems.push([...items]);
      return input?.quickPickSelection;
    },
    showInputBox: async () => input?.inputBoxValue,
    showErrorMessage: async (message) => {
      errors.push(message);
    },
    showWarningMessage: async (message) => {
      warnings.push(message);
    },
    showInformationMessage: async (message) => {
      infos.push(message);
    },
    executeCommand: async (command) => commands.get(command)?.(),
  };

  const activation: UserdataSwitcherActivation = {
    host,
    globalStoragePath,
    appRoot: "/Applications/Cursor.app/Contents/Resources/app",
    workspace: {
      workspaceFolders: [{ uri: { fsPath: "/repo" } }],
    },
    subscribe() {},
    ui,
    logger: {
      error: (message) => logs.push(`error:${message}`),
      info: (message) => logs.push(`info:${message}`),
    },
    launchEditorImpl: async (command) => {
      launched.push(command);
    },
    mkdirSync: (target, options) => {
      const directory = String(target);
      createdDirs.push(directory);
      fs.mkdirSync(directory, options);
    },
  };

  return {
    tempDir,
    storeRoot,
    defaultUserdataRoot,
    sharedExtensionsDirectory,
    host,
    statusBar,
    commands,
    launched,
    createdDirs,
    errors,
    warnings,
    infos,
    logs,
    quickPickItems,
    quickPickSelection: input?.quickPickSelection,
    inputBoxValue: input?.inputBoxValue,
    activation,
    run: async (command) => {
      const handler = commands.get(command);
      assert.ok(handler, `missing command handler for ${command}`);
      return handler();
    },
  };
}

describe("activateUserdataSwitcher", () => {
  const harnesses: TestHarness[] = [];
  const extraTempDirs: string[] = [];

  after(() => {
    for (const harness of harnesses) {
      fs.rmSync(harness.tempDir, { recursive: true, force: true });
    }
    for (const tempDir of extraTempDirs) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("registers userdata switcher commands", () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);

    assert.ok(harness.commands.has(COMMAND_OPEN_WITH_USERDATA));
    assert.ok(harness.commands.has(COMMAND_CREATE_USERDATA));
    assert.ok(harness.commands.has(COMMAND_RENAME_CURRENT_USERDATA));
    assert.ok(harness.commands.has(COMMAND_SHOW_CURRENT_USERDATA));
  });

  it("shows the current default userdata on the status bar", () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);

    assert.equal(harness.statusBar.text, "$(layers) Default (default)");
    assert.equal(
      harness.statusBar.tooltip,
      "Current Cursor Userdata: Default (default)",
    );
    assert.equal(harness.statusBar.command, COMMAND_OPEN_WITH_USERDATA);
    assert.deepEqual(harness.logs.slice(0, 3), [
      "info:Activated for Cursor",
      "info:appRoot=/Applications/Cursor.app/Contents/Resources/app",
      `info:globalStoragePath=${path.join(
        harness.defaultUserdataRoot,
        "User",
        "globalStorage",
        "publisher.ext",
        "globalStorage",
      )}`,
    ]);
  });

  it("launches the selected managed userdata from the open menu", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    const managedLaunch = harness.launched.at(-1);
    assert.ok(managedLaunch);
    assert.deepEqual(managedLaunch.args, [
      "--user-data-dir",
      path.join(harness.storeRoot, "u/personal"),
      "--extensions-dir",
      harness.sharedExtensionsDirectory,
      "/repo",
    ]);
    assert.ok(
      harness.logs.some((log) =>
        log.includes('Launching Cursor: "/app/bin/cursor" "--user-data-dir"'),
      ),
    );
  });

  it("routes the rename action in the open menu to rename current userdata", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: RENAME_CURRENT_USERDATA_LABEL,
        intent: { kind: "rename" },
      },
      inputBoxValue: "Work",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    const registry = loadRegistry(
      path.join(harness.storeRoot, "registry.json"),
    );
    assert.equal(registry.userdatas[0]?.label, "Work");
    assert.equal(harness.statusBar.text, "$(layers) Work (default)");
  });

  it("routes the create action in the open menu to create userdata", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: CREATE_USERDATA_LABEL,
        intent: { kind: "create" },
      },
      inputBoxValue: "Work",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    const registry = loadRegistry(
      path.join(harness.storeRoot, "registry.json"),
    );
    const managed = registry.userdatas.find(
      (entry) => entry.kind === "managed",
    );
    assert.equal(managed?.label, "Work");
    assert.equal(harness.createdDirs.length, 1);
    assert.ok(harness.launched.length > 0);
  });

  it("passes intent metadata through the open menu items", async () => {
    const harness = createTestHarness({
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.quickPickItems[0], [
      {
        label: "Personal",
        description: "Managed Userdata",
        intent: { kind: "open", userdataId: "personal" },
      },
      { label: "Actions", kind: -1 },
      {
        label: RENAME_CURRENT_USERDATA_LABEL,
        intent: { kind: "rename" },
        alwaysShow: true,
      },
      {
        label: CREATE_USERDATA_LABEL,
        intent: { kind: "create" },
        alwaysShow: true,
      },
    ]);
  });

  it("creates managed userdata, persists the registry, and launches it", async () => {
    const harness = createTestHarness({
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    const registry = loadRegistry(
      path.join(harness.storeRoot, "registry.json"),
    );
    const managed = registry.userdatas.find(
      (entry) => entry.kind === "managed",
    );
    assert.equal(managed?.label, "Personal");
    assert.equal(
      harness.createdDirs[0],
      path.join(harness.storeRoot, "u/personal"),
    );
    assert.deepEqual(harness.launched[0]?.args, [
      "--user-data-dir",
      path.join(harness.storeRoot, "u/personal"),
      "--extensions-dir",
      harness.sharedExtensionsDirectory,
      "/repo",
    ]);
  });

  it("warns when renaming unmanaged userdata", async () => {
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "userdata-switcher-unmanaged-test-"),
    );
    extraTempDirs.push(externalRoot);
    const harness = createTestHarness({
      globalStoragePath: path.join(
        externalRoot,
        "User",
        "globalStorage",
        "publisher.ext",
        "globalStorage",
      ),
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_RENAME_CURRENT_USERDATA);

    assert.deepEqual(harness.warnings, [
      "The current window is using unmanaged userdata.",
    ]);
  });

  it("renames the current userdata label", async () => {
    const harness = createTestHarness({
      inputBoxValue: "Work",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_RENAME_CURRENT_USERDATA);

    const registry = loadRegistry(
      path.join(harness.storeRoot, "registry.json"),
    );
    assert.equal(registry.userdatas[0]?.label, "Work");
    assert.equal(harness.statusBar.text, "$(layers) Work (default)");
  });

  it("shows the current userdata from the show command", async () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_SHOW_CURRENT_USERDATA);

    assert.deepEqual(harness.infos, [
      "Current Cursor Userdata: Default (default)",
    ]);
  });

  it("surfaces launch failures through the error UI", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      discoverEditorCli: () => null,
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    saveRegistry(path.join(harness.storeRoot, "registry.json"), {
      version: 1,
      userdatas: [
        { id: "default", kind: "default", label: "Default" },
        {
          id: "personal",
          kind: "managed",
          label: "Personal",
          relativeDataDir: "u/personal",
        },
      ],
    });

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.errors, [
      "Could not find Cursor CLI in this installation.",
    ]);
  });
});
