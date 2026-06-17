import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE,
  DELETE_NO_MANAGED_MESSAGE,
  DELETE_QUIT_AND_DELETE_LABEL,
  DELETE_QUIT_FAILED_MESSAGE,
  DELETE_TRASH_FAILURE_MESSAGE,
} from "./deleteUserdata";
import type { SupportedHostAdapter } from "./host";
import type { LaunchCommand, LaunchEditor } from "./launcher";
import {
  CREATE_USERDATA_LABEL,
  DELETE_USERDATA_LABEL,
  RENAME_CURRENT_USERDATA_LABEL,
  REVEAL_CURRENT_USERDATA_LABEL,
} from "./menu";
import { registryPath } from "./paths";
import { loadRegistry, saveRegistry } from "./registry";
import {
  activateUserdataSwitcher,
  COMMAND_CREATE_USERDATA,
  COMMAND_DELETE_USERDATA,
  COMMAND_OPEN_WITH_USERDATA,
  COMMAND_RENAME_CURRENT_USERDATA,
  COMMAND_REVEAL_CURRENT_USERDATA,
  COMMAND_SHOW_CURRENT_USERDATA,
  type QuickPickItem,
  type StatusBarItem,
  type UserdataSwitcherActivation,
  type UserdataSwitcherUi,
} from "./userdataSwitcherApp";

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
  revealedPaths: string[];
  deletedPaths: string[];
  logs: string[];
  uiEvents: string[];
  quickPickItems: readonly QuickPickItem[][];
  activation: UserdataSwitcherActivation;
  run(command: string): Promise<unknown>;
}

const START_FROM_CURRENT_SETTINGS_PICK: QuickPickItem = {
  label: "Start from current settings",
  description: "Recommended",
  creationMode: "seedCurrent",
};

const START_EMPTY_PICK: QuickPickItem = {
  label: "Start empty",
  description: "Fresh editor defaults",
  creationMode: "empty",
};

function globalStoragePathFor(userdataRoot: string): string {
  return path.join(
    userdataRoot,
    "User",
    "globalStorage",
    "publisher.ext",
    "globalStorage",
  );
}

function writeTextFile(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents, "utf8");
}

function savePersonalRegistry(storeRoot: string): void {
  saveRegistry(registryPath(storeRoot), {
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
}

function createTestHarness(input?: {
  globalStoragePath?: string;
  discoverEditorCli?: SupportedHostAdapter["discoverEditorCli"];
  quickPickSelection?: QuickPickItem;
  quickPickSelections?: readonly (QuickPickItem | undefined)[];
  inputBoxValue?: string;
  inputBoxValues?: readonly (string | undefined)[];
  launchEditorImpl?: LaunchEditor;
  mkdirSync?: UserdataSwitcherActivation["mkdirSync"];
  deletePathFailure?: boolean;
  warningMessageChoice?: string;
  warningMessageChoices?: readonly string[];
  isManagedUserdataInUse?: UserdataSwitcherActivation["isManagedUserdataInUse"];
  quitManagedUserdataInstance?: UserdataSwitcherActivation["quitManagedUserdataInstance"];
}): TestHarness {
  const tempRoot = process.platform === "darwin" ? "/tmp" : os.tmpdir();
  const tempDir = fs.mkdtempSync(
    path.join(tempRoot, "userdata-switcher-extension-test-"),
  );
  const storeRoot = path.join(tempDir, "store");
  const defaultUserdataRoot = path.join(tempDir, "default-userdata");
  const sharedExtensionsDirectory = path.join(tempDir, "shared-extensions");
  const globalStoragePath =
    input?.globalStoragePath ?? globalStoragePathFor(defaultUserdataRoot);

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
  const revealedPaths: string[] = [];
  const deletedPaths: string[] = [];
  const logs: string[] = [];
  const uiEvents: string[] = [];
  const quickPickItems: QuickPickItem[][] = [];
  const quickPickSelections = [
    ...(input?.quickPickSelections ??
      (input?.quickPickSelection !== undefined
        ? [input.quickPickSelection]
        : [])),
  ];
  const inputBoxValues = [
    ...(input?.inputBoxValues ??
      (input?.inputBoxValue !== undefined ? [input.inputBoxValue] : [])),
  ];
  const warningMessageChoices = [
    ...(input?.warningMessageChoices ??
      (input?.warningMessageChoice !== undefined
        ? [input.warningMessageChoice]
        : [])),
  ];

  const host: SupportedHostAdapter = {
    id: "cursor",
    displayName: "Cursor",
    cliNames: ["cursor"],
    resolveStoreRoot: () => storeRoot,
    resolveDefaultUserdataRoot: () => defaultUserdataRoot,
    resolveSharedExtensionsDirectory: () => sharedExtensionsDirectory,
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
      uiEvents.push("quickPick");
      quickPickItems.push([...items]);
      return quickPickSelections.shift();
    },
    showInputBox: async () => {
      uiEvents.push("inputBox");
      return inputBoxValues.shift();
    },
    showErrorMessage: async (message) => {
      errors.push(message);
    },
    showWarningMessage: async (message, ...items) => {
      warnings.push(message);
      const choice = warningMessageChoices.shift();
      return choice ?? items[0];
    },
    showInformationMessage: async (message) => {
      infos.push(message);
    },
    revealPathInOs: async (fsPath) => {
      revealedPaths.push(fsPath);
    },
    deletePath: async (fsPath) => {
      if (input?.deletePathFailure) {
        throw new Error("mock delete failure");
      }
      deletedPaths.push(fsPath);
      if (fs.existsSync(fsPath)) {
        fs.rmSync(fsPath, { recursive: true, force: true });
      }
    },
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
    launchEditorImpl:
      input?.launchEditorImpl ??
      (async (command) => {
        launched.push(command);
      }),
    mkdirSync:
      input?.mkdirSync ??
      ((target, options) => {
        const directory = String(target);
        createdDirs.push(directory);
        fs.mkdirSync(directory, options);
      }),
    isManagedUserdataInUse: input?.isManagedUserdataInUse,
    quitManagedUserdataInstance: input?.quitManagedUserdataInstance,
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
    revealedPaths,
    deletedPaths,
    logs,
    uiEvents,
    quickPickItems,
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
    assert.ok(harness.commands.has(COMMAND_REVEAL_CURRENT_USERDATA));
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
      `info:globalStoragePath=${globalStoragePathFor(harness.defaultUserdataRoot)}`,
    ]);
  });

  it("shows the current managed userdata on the status bar", () => {
    const harness = createTestHarness();
    harnesses.push(harness);
    const managedDir = path.join(harness.storeRoot, "u/personal");
    harness.activation.globalStoragePath = globalStoragePathFor(managedDir);
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);

    assert.equal(harness.statusBar.text, "$(layers) Personal");
    assert.equal(
      harness.statusBar.tooltip,
      "Current Cursor Userdata: Personal",
    );
  });

  it("shows unmanaged userdata on the status bar", () => {
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "userdata-switcher-unmanaged-status-test-"),
    );
    extraTempDirs.push(externalRoot);
    const harness = createTestHarness({
      globalStoragePath: globalStoragePathFor(externalRoot),
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);

    assert.equal(harness.statusBar.text, "$(layers) Unmanaged");
    assert.equal(
      harness.statusBar.tooltip,
      "Current Cursor Userdata: Unmanaged",
    );
  });

  it("launches the selected managed userdata from the open menu", async () => {
    const harness = createTestHarness({
      quickPickSelections: [
        START_FROM_CURRENT_SETTINGS_PICK,
        {
          label: "Personal",
          intent: { kind: "open", userdataId: "personal" },
        },
      ],
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

    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas[0]?.label, "Work");
    assert.equal(harness.statusBar.text, "$(layers) Work (default)");
  });

  it("routes the create action in the open menu to create userdata", async () => {
    const harness = createTestHarness({
      quickPickSelections: [
        {
          label: CREATE_USERDATA_LABEL,
          intent: { kind: "create" },
        },
        START_FROM_CURRENT_SETTINGS_PICK,
      ],
      inputBoxValue: "Work",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    const registry = loadRegistry(registryPath(harness.storeRoot));
    const managed = registry.userdatas.find(
      (entry) => entry.kind === "managed",
    );
    assert.equal(managed?.label, "Work");
    assert.equal(harness.createdDirs.length, 1);
    assert.ok(harness.launched.length > 0);
  });

  it("passes intent metadata through the open menu items", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.quickPickItems[1], [
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
        label: REVEAL_CURRENT_USERDATA_LABEL,
        intent: { kind: "reveal" },
        alwaysShow: true,
      },
      {
        label: CREATE_USERDATA_LABEL,
        intent: { kind: "create" },
        alwaysShow: true,
      },
      {
        label: DELETE_USERDATA_LABEL,
        intent: { kind: "delete" },
        alwaysShow: true,
      },
    ]);
  });

  it("creates managed userdata, persists the registry, and launches it", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    const registry = loadRegistry(registryPath(harness.storeRoot));
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

  it("prompts for creation mode before the userdata label", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    assert.deepEqual(harness.quickPickItems[0], [
      START_FROM_CURRENT_SETTINGS_PICK,
      START_EMPTY_PICK,
    ]);
    assert.deepEqual(harness.uiEvents.slice(0, 2), ["quickPick", "inputBox"]);
  });

  it("seeds new userdata from current settings without copying identity state", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);
    const currentUserDir = path.join(harness.defaultUserdataRoot, "User");
    writeTextFile(
      path.join(currentUserDir, "settings.json"),
      '{ "workbench.colorTheme": "Quiet Light" }\n',
    );
    writeTextFile(
      path.join(currentUserDir, "keybindings.json"),
      '[{ "key": "cmd+k cmd+t", "command": "workbench.action.selectTheme" }]\n',
    );
    writeTextFile(
      path.join(currentUserDir, "snippets", "typescript.json"),
      '{ "hello": { "prefix": "hi" } }\n',
    );
    writeTextFile(
      path.join(currentUserDir, "globalStorage", "auth.json"),
      '{ "token": "secret" }\n',
    );
    writeTextFile(
      path.join(currentUserDir, "workspaceStorage", "state.json"),
      '{ "workspace": true }\n',
    );
    writeTextFile(
      path.join(currentUserDir, "History", "chat.json"),
      '{ "chat": true }\n',
    );
    writeTextFile(path.join(currentUserDir, "Cache", "cache.bin"), "cache\n");
    writeTextFile(path.join(currentUserDir, "logs", "main.log"), "log\n");
    writeTextFile(
      path.join(currentUserDir, "globalStorage", "publisher.extension"),
      '{ "extensionState": true }\n',
    );

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    const managedUserDir = path.join(harness.storeRoot, "u/personal", "User");
    assert.equal(
      fs.readFileSync(path.join(managedUserDir, "settings.json"), "utf8"),
      '{ "workbench.colorTheme": "Quiet Light" }\n',
    );
    assert.equal(
      fs.readFileSync(path.join(managedUserDir, "keybindings.json"), "utf8"),
      '[{ "key": "cmd+k cmd+t", "command": "workbench.action.selectTheme" }]\n',
    );
    assert.equal(
      fs.readFileSync(
        path.join(managedUserDir, "snippets", "typescript.json"),
        "utf8",
      ),
      '{ "hello": { "prefix": "hi" } }\n',
    );
    assert.equal(
      fs.existsSync(path.join(managedUserDir, "globalStorage", "auth.json")),
      false,
    );
    assert.equal(
      fs.existsSync(
        path.join(managedUserDir, "workspaceStorage", "state.json"),
      ),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(managedUserDir, "History", "chat.json")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(managedUserDir, "Cache", "cache.bin")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(managedUserDir, "logs", "main.log")),
      false,
    );
    assert.equal(
      fs.existsSync(
        path.join(managedUserDir, "globalStorage", "publisher.extension"),
      ),
      false,
    );
  });

  it("seeds from the current managed userdata when that window creates another", async () => {
    const sourceManagedDir = "u/personal";
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Client",
    });
    harnesses.push(harness);
    harness.activation.globalStoragePath = globalStoragePathFor(
      path.join(harness.storeRoot, sourceManagedDir),
    );
    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);
    writeTextFile(
      path.join(harness.defaultUserdataRoot, "User", "settings.json"),
      '{ "workbench.colorTheme": "Default Dark Modern" }\n',
    );
    writeTextFile(
      path.join(harness.storeRoot, sourceManagedDir, "User", "settings.json"),
      '{ "workbench.colorTheme": "Solarized Light" }\n',
    );
    writeTextFile(
      path.join(
        harness.storeRoot,
        sourceManagedDir,
        "User",
        "snippets",
        "go.json",
      ),
      '{ "test": { "prefix": "tt" } }\n',
    );

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    const managedUserDir = path.join(harness.storeRoot, "u/client", "User");
    assert.equal(
      fs.readFileSync(path.join(managedUserDir, "settings.json"), "utf8"),
      '{ "workbench.colorTheme": "Solarized Light" }\n',
    );
    assert.equal(
      fs.readFileSync(path.join(managedUserDir, "snippets", "go.json"), "utf8"),
      '{ "test": { "prefix": "tt" } }\n',
    );
  });

  it("starts empty when creating userdata with fresh editor defaults", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_EMPTY_PICK,
      inputBoxValue: "Personal",
    });
    harnesses.push(harness);
    const currentUserDir = path.join(harness.defaultUserdataRoot, "User");
    writeTextFile(
      path.join(currentUserDir, "settings.json"),
      '{ "workbench.colorTheme": "Quiet Light" }\n',
    );

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    assert.equal(
      fs.existsSync(
        path.join(harness.storeRoot, "u/personal", "User", "settings.json"),
      ),
      false,
    );
  });

  it("does not persist a managed userdata when directory creation fails", async () => {
    const harness = createTestHarness({
      quickPickSelection: START_FROM_CURRENT_SETTINGS_PICK,
      inputBoxValue: "Personal",
      mkdirSync: () => {
        throw new Error("mkdir failed");
      },
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_CREATE_USERDATA);

    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.deepEqual(registry.userdatas, [
      { id: "default", kind: "default", label: "Default" },
    ]);
    assert.deepEqual(harness.errors, ["mkdir failed"]);
    assert.deepEqual(harness.launched, []);
  });

  it("warns when renaming unmanaged userdata", async () => {
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "userdata-switcher-unmanaged-test-"),
    );
    extraTempDirs.push(externalRoot);
    const harness = createTestHarness({
      globalStoragePath: globalStoragePathFor(externalRoot),
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

    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas[0]?.label, "Work");
    assert.equal(harness.statusBar.text, "$(layers) Work (default)");
  });

  it("reloads the registry before renaming the current userdata", async () => {
    const managedDir = path.join("u", "personal");
    const harness = createTestHarness({
      inputBoxValue: "Client",
    });
    harnesses.push(harness);
    harness.activation.globalStoragePath = globalStoragePathFor(
      path.join(harness.storeRoot, managedDir),
    );

    activateUserdataSwitcher(harness.activation);
    savePersonalRegistry(harness.storeRoot);
    await harness.run(COMMAND_RENAME_CURRENT_USERDATA);

    const registry = loadRegistry(registryPath(harness.storeRoot));
    const managed = registry.userdatas.find((entry) => entry.id === "personal");
    assert.equal(managed?.label, "Client");
    assert.deepEqual(harness.warnings, []);
  });

  it("reveals the current default userdata directory", async () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_REVEAL_CURRENT_USERDATA);

    assert.deepEqual(harness.revealedPaths, [harness.defaultUserdataRoot]);
    assert.ok(
      harness.logs.some((log) =>
        log.includes(
          `Reveal diagnostics resolvedUserdataRoot=${harness.defaultUserdataRoot}`,
        ),
      ),
    );
  });

  it("reveals managed userdata from the open menu", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: REVEAL_CURRENT_USERDATA_LABEL,
        intent: { kind: "reveal" },
      },
    });
    harnesses.push(harness);

    const managedDir = path.join(harness.storeRoot, "u/personal");
    harness.activation.globalStoragePath = globalStoragePathFor(managedDir);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.revealedPaths, [managedDir]);
  });

  it("reveals unmanaged userdata from its global storage path", async () => {
    const externalRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "userdata-switcher-unmanaged-reveal-test-"),
    );
    extraTempDirs.push(externalRoot);
    const harness = createTestHarness({
      globalStoragePath: globalStoragePathFor(externalRoot),
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_REVEAL_CURRENT_USERDATA);

    assert.deepEqual(harness.revealedPaths, [externalRoot]);
  });

  it("warns when revealing an unknown userdata path", async () => {
    const harness = createTestHarness({
      globalStoragePath: path.join(
        "/not",
        "an",
        "extension",
        "storage",
        "path",
      ),
    });
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_REVEAL_CURRENT_USERDATA);

    assert.deepEqual(harness.revealedPaths, []);
    assert.deepEqual(harness.warnings, [
      "Could not determine the current userdata directory.",
    ]);
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

  it("reloads the registry before showing the current userdata", async () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    saveRegistry(registryPath(harness.storeRoot), {
      version: 1,
      userdatas: [{ id: "default", kind: "default", label: "Work" }],
    });

    await harness.run(COMMAND_SHOW_CURRENT_USERDATA);

    assert.deepEqual(harness.infos, [
      "Current Cursor Userdata: Work (default)",
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
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.errors, [
      "Could not find Cursor CLI in this installation.",
    ]);
  });

  it("surfaces async launch failures through the error UI", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      launchEditorImpl: async () => {
        throw new Error("spawn failed");
      },
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_OPEN_WITH_USERDATA);

    assert.deepEqual(harness.errors, ["spawn failed"]);
  });

  it("deletes the selected managed userdata, removes it from registry, and moves folder to trash", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: "Delete",
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.deletedPaths, [
      path.join(harness.storeRoot, "u/personal"),
    ]);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.deepEqual(registry.userdatas, [
      { id: "default", kind: "default", label: "Default" },
    ]);
    assert.deepEqual(harness.infos, ['Userdata "Personal" has been deleted.']);
  });

  it("does not delete the userdata if user cancels the confirmation dialog", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: "Cancel",
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.deletedPaths, []);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas.length, 2);
    assert.deepEqual(harness.infos, []);
  });

  it("shows warning when there are no managed userdatas to delete", async () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.warnings, [DELETE_NO_MANAGED_MESSAGE]);
    assert.deepEqual(harness.deletedPaths, []);
  });

  it("blocks deleting the current window managed userdata", async () => {
    const harness = createTestHarness();
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);
    harness.activation.globalStoragePath = globalStoragePathFor(
      path.join(harness.storeRoot, "u/personal"),
    );

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.warnings, [DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE]);
    assert.deepEqual(harness.deletedPaths, []);
  });

  it("blocks deletion when the target userdata is still running and user cancels", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: "Cancel",
      isManagedUserdataInUse: async () => true,
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.deletedPaths, []);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas.length, 2);
    assert.equal(harness.warnings.length, 1);
    assert.match(harness.warnings[0], /still running/);
    assert.match(harness.warnings[0], /Quit and delete/);
  });

  it("quits a running instance and deletes when the user confirms quit and delete", async () => {
    let inUse = true;
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: DELETE_QUIT_AND_DELETE_LABEL,
      isManagedUserdataInUse: async () => inUse,
      quitManagedUserdataInstance: async () => {
        inUse = false;
        return true;
      },
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.deletedPaths, [
      path.join(harness.storeRoot, "u/personal"),
    ]);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.deepEqual(registry.userdatas, [
      { id: "default", kind: "default", label: "Default" },
    ]);
    assert.deepEqual(harness.infos, ['Userdata "Personal" has been deleted.']);
  });

  it("shows quit failure when the running instance cannot be stopped", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: DELETE_QUIT_AND_DELETE_LABEL,
      isManagedUserdataInUse: async () => true,
      quitManagedUserdataInstance: async () => false,
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.deepEqual(harness.deletedPaths, []);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas.length, 2);
    assert.equal(harness.warnings.length, 2);
    assert.match(harness.warnings[0], /still running/);
    assert.deepEqual(harness.warnings[1], DELETE_QUIT_FAILED_MESSAGE);
  });

  it("handles deletion failure gracefully, keeping the entry in the registry", async () => {
    const harness = createTestHarness({
      quickPickSelection: {
        label: "Personal",
        intent: { kind: "open", userdataId: "personal" },
      },
      warningMessageChoice: "Delete",
      deletePathFailure: true,
    });
    harnesses.push(harness);

    fs.mkdirSync(harness.storeRoot, { recursive: true });
    savePersonalRegistry(harness.storeRoot);

    activateUserdataSwitcher(harness.activation);
    await harness.run(COMMAND_DELETE_USERDATA);

    assert.equal(harness.warnings.length, 2);
    assert.match(harness.warnings[0], /Delete userdata "Personal"/);
    assert.deepEqual(harness.warnings[1], DELETE_TRASH_FAILURE_MESSAGE);
    const registry = loadRegistry(registryPath(harness.storeRoot));
    assert.equal(registry.userdatas.length, 2);
    assert.ok(registry.userdatas.some((entry) => entry.id === "personal"));
  });
});

describe("createVscodeUi", () => {
  it("surfaces errors when revealFileInOS command fails", async () => {
    // We mock require for vscode because node:test does not have module mocking
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Module } = require("node:module");
    const origRequire = Module.prototype.require;
    let ui: UserdataSwitcherUi | undefined;
    const logs: string[] = [];

    Module.prototype.require = function (...args: unknown[]) {
      const id = args[0];
      if (id === "vscode") {
        return {
          commands: {
            executeCommand: async (cmd: string) => {
              if (cmd === "revealFileInOS") {
                throw new Error("mock reveal failure");
              }
            },
          },
          workspace: {
            fs: {
              delete: async () => {},
            },
          },
          Uri: {
            file: (f: string) => ({ fsPath: f, toString: () => f }),
          },
          StatusBarAlignment: {},
          QuickPickItemKind: {},
        };
      }
      return origRequire.apply(this, args);
    };

    try {
      // Clear the cache so we actually require with the mocked vscode
      delete require.cache[require.resolve("./extension.ts")];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createVscodeUi } = require("./extension.ts");
      ui = createVscodeUi({
        info: (msg: string) => logs.push(`info:${msg}`),
        error: (msg: string) => logs.push(`error:${msg}`),
      });
    } finally {
      Module.prototype.require = origRequire;
      // Remove the polluted module from the cache so future requires get the real one
      delete require.cache[require.resolve("./extension.ts")];
    }

    try {
      if (ui) {
        await ui.revealPathInOs("/some/path");
      }
      assert.fail("should have thrown");
    } catch (e: unknown) {
      assert.equal(
        e instanceof Error ? e.message : String(e),
        "mock reveal failure",
      );
    }

    assert.ok(
      logs.some((l) =>
        l.includes("error:revealFileInOS failed: mock reveal failure"),
      ),
    );
  });
});
