import fs from "node:fs";
import { executeManagedUserdataDeletion } from "./deleteManagedUserdata";
import {
  DELETE_QUIT_FAILED_MESSAGE,
  DELETE_TRASH_FAILURE_MESSAGE,
  DELETE_VERIFY_INSTANCE_STILL_RUNNING_MESSAGE,
  DELETE_VERIFY_PATH_STILL_EXISTS_MESSAGE,
  describeDeleteUserdataBlockedReason,
  listDeletableManagedUserdatas,
} from "./deleteUserdata";
import { resolveUserdataEntryRoot } from "./detect";
import { EditorHostSession } from "./editorHostSession";
import type { SupportedHostAdapter } from "./host";
import {
  formatStatusBarText,
  formatUserdataEntryLabel,
  formatUserdataLabel,
} from "./labels";
import {
  type LaunchEditor,
  type LaunchLogger,
  openWithUserdata,
  type WorkspaceShape,
} from "./launcher";
import { provisionManagedUserdata } from "./managedUserdataProvisioner";
import {
  buildDeleteUserdataMenuItems,
  buildManageUserdataActionMenuItems,
  buildManageUserdatasMenuItems,
  buildOpenInNewWindowMenuItems,
  DELETE_USERDATA_PLACEHOLDER,
  DELETE_USERDATA_TITLE,
  MANAGE_USERDATAS_PLACEHOLDER,
  MANAGE_USERDATAS_TITLE,
  OPEN_USERDATA_IN_NEW_WINDOW_PLACEHOLDER,
  OPEN_USERDATA_IN_NEW_WINDOW_TITLE,
  resolveUserdataMenuIntent,
  type UserdataMenuIntent,
  type UserdataMenuItem,
  type UserdataMenuItemIntent,
  type UserdataRunningState,
} from "./menu";
import { registryPath, resolveManagedDataDir } from "./paths";
import {
  type Registry,
  removeUserdata,
  renameUserdata,
  type UserdataEntry,
} from "./registry";
import { UserdataRegistryStore } from "./registryStore";
import {
  isUserdataEditorInstanceRunning,
  quitUserdataEditorInstance,
} from "./runningEditorInstance";

export const COMMAND_OPEN_IN_NEW_WINDOW = "userdataSwitcher.openInNewWindow";
export const COMMAND_CREATE_USERDATA = "userdataSwitcher.createUserdata";
export const COMMAND_RENAME_CURRENT_USERDATA =
  "userdataSwitcher.renameCurrentUserdata";
export const COMMAND_SHOW_CURRENT_USERDATA =
  "userdataSwitcher.showCurrentUserdata";
export const COMMAND_REVEAL_CURRENT_USERDATA =
  "userdataSwitcher.revealCurrentUserdata";
export const COMMAND_DELETE_USERDATA = "userdataSwitcher.deleteUserdata";

export interface QuickPickItem {
  label: string;
  description?: string;
  kind?: number;
  intent?: UserdataMenuItemIntent;
  alwaysShow?: boolean;
}

export interface StatusBarItem {
  text: string;
  tooltip: string;
  command: string;
  show(): void;
}

export interface Disposable {
  dispose(): void;
}

export interface UserdataSwitcherUi {
  StatusBarAlignment: { Left: number };
  QuickPickItemKind: { Separator: number };
  createStatusBarItem(alignment: number, priority: number): StatusBarItem;
  registerCommand(
    command: string,
    callback: (...args: unknown[]) => unknown,
  ): Disposable;
  showQuickPick(
    items: readonly QuickPickItem[],
    options: { title: string; placeHolder: string },
  ): PromiseLike<QuickPickItem | undefined>;
  showInputBox(options: {
    title: string;
    prompt: string;
    placeHolder?: string;
    value?: string;
    validateInput?(value: string): string | undefined;
  }): PromiseLike<string | undefined>;
  showErrorMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined>;
  showWarningMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined>;
  showInformationMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined>;
  revealPathInOs(fsPath: string): PromiseLike<unknown>;
  deletePath(fsPath: string, options: { useTrash: boolean }): PromiseLike<void>;
  showOutput(): void;
}

export interface UserdataSwitcherActivation {
  host: SupportedHostAdapter;
  globalStoragePath: string;
  appRoot: string;
  workspace: WorkspaceShape;
  subscribe(disposable: Disposable): void;
  ui: UserdataSwitcherUi;
  logger?: LaunchLogger;
  launchEditorImpl?: LaunchEditor;
  mkdirSync?: typeof fs.mkdirSync;
  editorVersion?: string;
  isManagedUserdataInUse?: (managedUserdataRoot: string) => Promise<boolean>;
  quitManagedUserdataInstance?: (
    managedUserdataRoot: string,
  ) => Promise<boolean>;
}

type UserdataCreationMode = "seedCurrent" | "empty";

const CREATE_FROM_CURRENT_SETTINGS_LABEL = "Start from current settings";
const CREATE_EMPTY_LABEL = "Start empty";
const OPEN_OUTPUT_LABEL = "Open Output";

function requireNonEmptyLabel(value: string): string | undefined {
  return value.trim() ? undefined : "Label is required";
}

function toQuickPickItems(
  items: readonly UserdataMenuItem[],
  separatorKind: number,
): QuickPickItem[] {
  return items.map((item) => {
    if (item.kind === "separator") {
      return { label: item.label, kind: separatorKind };
    }
    const { kind: _kind, ...quickPickItem } = item;
    return quickPickItem;
  });
}

async function resolveRunningByUserdataId(input: {
  registry: Registry;
  storeRoot: string;
  defaultUserdataRoot: string;
  isRunning: (root: string) => Promise<boolean>;
}): Promise<Map<string, UserdataRunningState>> {
  const runningByUserdataId = new Map<string, UserdataRunningState>();
  await Promise.all(
    input.registry.userdatas.map(async (entry) => {
      const root = resolveUserdataEntryRoot({
        entry,
        storeRoot: input.storeRoot,
        defaultUserdataRoot: input.defaultUserdataRoot,
      });
      if (!root) {
        return;
      }
      runningByUserdataId.set(
        entry.id,
        (await input.isRunning(root)) ? "running" : "idle",
      );
    }),
  );
  return runningByUserdataId;
}

export function activateUserdataSwitcher(
  input: UserdataSwitcherActivation,
): void {
  const {
    host,
    globalStoragePath,
    appRoot,
    workspace,
    subscribe,
    ui,
    logger,
    launchEditorImpl,
    mkdirSync,
    editorVersion,
    isManagedUserdataInUse = async (managedUserdataRoot) =>
      isUserdataEditorInstanceRunning(managedUserdataRoot, {
        editorVersion,
      }),
    quitManagedUserdataInstance = async (managedUserdataRoot) =>
      quitUserdataEditorInstance(managedUserdataRoot, { editorVersion }),
  } = input;

  const storeRoot = host.resolveStoreRoot();
  const defaultUserdataRoot = host.resolveDefaultUserdataRoot();
  const registryFile = registryPath(storeRoot);
  const registryStore = new UserdataRegistryStore(registryFile);
  const pickMenuIntent = async (
    registry: Registry,
    menuItems: UserdataMenuItem[],
    options: { title: string; placeHolder: string },
  ): Promise<UserdataMenuIntent> => {
    const selected = await ui.showQuickPick(
      toQuickPickItems(menuItems, ui.QuickPickItemKind.Separator),
      options,
    );
    return resolveUserdataMenuIntent(registry, selected);
  };
  const session = new EditorHostSession({
    globalStoragePath,
    defaultUserdataRoot,
    storeRoot,
  });

  logger?.info(`Activated for ${host.displayName}`);
  logger?.info(`appRoot=${appRoot}`);
  logger?.info(`globalStoragePath=${globalStoragePath}`);
  logger?.info(`storeRoot=${storeRoot}`);
  logger?.info(`defaultUserdataRoot=${defaultUserdataRoot}`);
  logger?.info(`registryFile=${registryFile}`);

  registryStore.ensureInitialized();

  const currentUserdata = (registry: Registry = registryStore.read()) =>
    session.currentUserdata(registry);

  const statusBarItem = ui.createStatusBarItem(ui.StatusBarAlignment.Left, 100);
  statusBarItem.command = COMMAND_OPEN_IN_NEW_WINDOW;

  const refreshStatusBar = (registry?: Registry) => {
    const current = currentUserdata(registry);
    statusBarItem.text = formatStatusBarText(current);
    statusBarItem.tooltip = `Current ${host.displayName} Userdata: ${formatUserdataLabel(current)}`;
    statusBarItem.show();
  };

  const revealUserdata = async (entry: UserdataEntry) => {
    const userdataRoot = resolveUserdataEntryRoot({
      entry,
      storeRoot,
      defaultUserdataRoot,
    });
    if (!userdataRoot) {
      await ui.showWarningMessage(
        "Could not determine the userdata directory.",
      );
      return;
    }
    logger?.info(`Reveal userdata ${entry.id}: ${userdataRoot}`);
    await ui.revealPathInOs(userdataRoot);
  };

  const revealCurrentUserdata = async () => {
    const current = currentUserdata();
    if (current.kind === "known") {
      await revealUserdata(current.entry);
      return;
    }

    const userdataRoot = session.currentUserdataRoot(current);
    if (!userdataRoot) {
      await ui.showWarningMessage(
        "Could not determine the current userdata directory.",
      );
      return;
    }
    await ui.revealPathInOs(userdataRoot);
  };

  const launchEntrySafely = async (entry: UserdataEntry) => {
    try {
      await openWithUserdata({
        entry,
        host,
        appRoot,
        storeRoot,
        workspace,
        editorVersion,
        logger,
        launchEditorImpl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`Launch failed: ${message}`);
      const choice = await ui.showErrorMessage(message, OPEN_OUTPUT_LABEL);
      if (choice === OPEN_OUTPUT_LABEL) {
        ui.showOutput();
      }
    }
  };

  const pickUserdataCreationMode = async (
    label: string,
  ): Promise<UserdataCreationMode | undefined> => {
    const choice = await ui.showInformationMessage(
      `How should "${label}" be initialized?`,
      CREATE_FROM_CURRENT_SETTINGS_LABEL,
      CREATE_EMPTY_LABEL,
    );
    if (choice === CREATE_FROM_CURRENT_SETTINGS_LABEL) {
      return "seedCurrent";
    }
    if (choice === CREATE_EMPTY_LABEL) {
      return "empty";
    }
    return undefined;
  };

  const createUserdata = async () => {
    const label = await ui.showInputBox({
      title: "Create Userdata",
      prompt: `Enter a label for the new ${host.displayName} Userdata`,
      placeHolder: "Personal",
      validateInput: requireNonEmptyLabel,
    });
    if (!label) {
      logger?.info("Create userdata cancelled");
      return;
    }
    const creationMode = await pickUserdataCreationMode(label);
    if (!creationMode) {
      logger?.info("Create userdata cancelled");
      return;
    }
    const sourceUserdataRoot =
      creationMode === "seedCurrent"
        ? (session.currentUserdataRoot(currentUserdata()) ?? undefined)
        : undefined;
    try {
      if (creationMode === "seedCurrent" && !sourceUserdataRoot) {
        throw new Error(
          "Could not determine the current userdata directory to copy settings from.",
        );
      }
      const created = provisionManagedUserdata({
        label,
        mkdirSync,
        registryStore,
        sourceUserdataRoot,
        storeRoot,
      });
      refreshStatusBar(created.registry);
      logger?.info(
        `Created managed userdata ${created.entry.id}: ${created.managedDataDir}`,
      );
      await launchEntrySafely(created.entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`Create userdata failed: ${message}`);
      await ui.showErrorMessage(message);
    }
  };

  const renameUserdataEntry = async (entry: UserdataEntry) => {
    const label = await ui.showInputBox({
      title: "Rename Userdata",
      prompt: "Enter a new label",
      value: entry.label,
      validateInput: requireNonEmptyLabel,
    });
    if (!label) {
      logger?.info("Rename userdata cancelled");
      return;
    }
    const updatedRegistry = registryStore.update((latest) =>
      renameUserdata(latest, entry.id, label),
    );
    refreshStatusBar(updatedRegistry);
    logger?.info(`Renamed userdata ${entry.id} to ${label}`);
  };

  const renameCurrentUserdata = async () => {
    const current = currentUserdata();
    if (current.kind === "unmanaged") {
      await ui.showWarningMessage(
        "The current window is using unmanaged userdata.",
      );
      return;
    }
    await renameUserdataEntry(current.entry);
  };

  const deleteManagedUserdataEntry = async (targetEntry: UserdataEntry) => {
    if (!targetEntry.relativeDataDir) {
      return;
    }

    let targetPath: string;
    try {
      targetPath = resolveManagedDataDir(
        storeRoot,
        targetEntry.relativeDataDir,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`Resolve path failed: ${message}`);
      await ui.showErrorMessage(message);
      return;
    }

    const outcome = await executeManagedUserdataDeletion({
      targetPath,
      label: targetEntry.label,
      editorVersion,
      isManagedUserdataInUse,
      quitManagedUserdataInstance,
      deletePath: async (managedUserdataRoot) => {
        await ui.deletePath(managedUserdataRoot, { useTrash: true });
      },
      pathExists: (managedUserdataRoot) => fs.existsSync(managedUserdataRoot),
      confirmDeletion: async (message, confirmLabel) => {
        const choice = await ui.showInformationMessage(message, confirmLabel);
        return choice === confirmLabel;
      },
      logInfo: (message) => logger?.info(message),
      logError: (message) => logger?.error(message),
    });

    switch (outcome.status) {
      case "cancelled":
        logger?.info("Delete userdata cancelled by user confirmation");
        return;
      case "quit-failed":
        logger?.info(
          `Delete userdata blocked: ${targetEntry.id} editor instance could not be quit`,
        );
        await ui.showWarningMessage(DELETE_QUIT_FAILED_MESSAGE);
        return;
      case "delete-failed": {
        logger?.error(`Delete userdata files failed for ${targetEntry.id}`);
        await ui.showWarningMessage(DELETE_TRASH_FAILURE_MESSAGE);
        return;
      }
      case "verify-failed":
        logger?.error(
          `Delete userdata verification failed for ${targetEntry.id}: ${outcome.reason}`,
        );
        await ui.showWarningMessage(
          outcome.reason === "path-still-exists"
            ? DELETE_VERIFY_PATH_STILL_EXISTS_MESSAGE
            : DELETE_VERIFY_INSTANCE_STILL_RUNNING_MESSAGE,
        );
        return;
      case "success": {
        const updatedRegistry = registryStore.update((latest) =>
          removeUserdata(latest, targetEntry.id),
        );
        refreshStatusBar(updatedRegistry);
        logger?.info(
          `Deleted userdata ${targetEntry.id} and moved files to trash`,
        );
        await ui.showInformationMessage(
          `Userdata "${targetEntry.label}" has been deleted.`,
        );
        return;
      }
    }
  };

  const deleteUserdata = async () => {
    const currentRegistry = registryStore.read();
    const current = currentUserdata(currentRegistry);
    const deletable = listDeletableManagedUserdatas(currentRegistry, current);
    const blockedReason = describeDeleteUserdataBlockedReason(
      currentRegistry,
      current,
      deletable,
    );
    if (blockedReason) {
      await ui.showWarningMessage(blockedReason);
      return;
    }

    const intent = await pickMenuIntent(
      currentRegistry,
      buildDeleteUserdataMenuItems(deletable),
      {
        title: DELETE_USERDATA_TITLE,
        placeHolder: DELETE_USERDATA_PLACEHOLDER,
      },
    );
    if (intent.kind !== "delete") {
      logger?.info("Delete userdata cancelled");
      return;
    }

    await deleteManagedUserdataEntry(intent.entry);
  };

  const manageUserdataActions = async (entry: UserdataEntry) => {
    const registry = registryStore.read();
    const intent = await pickMenuIntent(
      registry,
      buildManageUserdataActionMenuItems(entry, currentUserdata(registry)),
      {
        title: formatUserdataEntryLabel(entry),
        placeHolder: "Choose an action",
      },
    );
    if (intent.kind === "cancel") {
      logger?.info("Manage userdata action cancelled");
      return;
    }
    if (intent.kind === "rename") {
      logger?.info(`Menu intent: rename userdata ${intent.entry.id}`);
      await renameUserdataEntry(intent.entry);
      return;
    }
    if (intent.kind === "reveal") {
      logger?.info(`Menu intent: reveal userdata ${intent.entry.id}`);
      await revealUserdata(intent.entry);
      return;
    }
    if (intent.kind === "delete") {
      logger?.info(`Menu intent: delete userdata ${intent.entry.id}`);
      await deleteManagedUserdataEntry(intent.entry);
    }
  };

  const manageUserdatas = async () => {
    const currentRegistry = registryStore.read();
    const intent = await pickMenuIntent(
      currentRegistry,
      buildManageUserdatasMenuItems(currentRegistry),
      {
        title: MANAGE_USERDATAS_TITLE,
        placeHolder: MANAGE_USERDATAS_PLACEHOLDER,
      },
    );
    if (intent.kind === "cancel") {
      logger?.info("Manage userdatas cancelled");
      return;
    }
    if (intent.kind === "managePick") {
      logger?.info(`Menu intent: manage userdata ${intent.entry.id}`);
      await manageUserdataActions(intent.entry);
    }
  };

  const openInNewWindowMenu = async () => {
    const currentRegistry = registryStore.read();
    const current = currentUserdata(currentRegistry);
    logger?.info(
      `Opening menu from current userdata: ${formatUserdataLabel(current)}`,
    );
    refreshStatusBar(currentRegistry);
    const runningByUserdataId = await resolveRunningByUserdataId({
      registry: currentRegistry,
      storeRoot,
      defaultUserdataRoot,
      isRunning: isManagedUserdataInUse,
    });
    const intent = await pickMenuIntent(
      currentRegistry,
      buildOpenInNewWindowMenuItems(
        currentRegistry,
        current,
        runningByUserdataId,
      ),
      {
        title: OPEN_USERDATA_IN_NEW_WINDOW_TITLE,
        placeHolder: OPEN_USERDATA_IN_NEW_WINDOW_PLACEHOLDER,
      },
    );
    if (intent.kind === "cancel") {
      logger?.info("Menu cancelled");
      return;
    }
    if (intent.kind === "create") {
      logger?.info("Menu intent: create userdata");
      await createUserdata();
      return;
    }
    if (intent.kind === "manage") {
      logger?.info("Menu intent: manage userdatas");
      await manageUserdatas();
      return;
    }
    if (intent.kind === "open") {
      logger?.info(`Menu intent: open userdata ${intent.entry.id}`);
      await launchEntrySafely(intent.entry);
    }
  };

  subscribe(statusBarItem as unknown as Disposable);
  subscribe(
    ui.registerCommand(COMMAND_OPEN_IN_NEW_WINDOW, openInNewWindowMenu),
  );
  subscribe(ui.registerCommand(COMMAND_CREATE_USERDATA, createUserdata));
  subscribe(
    ui.registerCommand(COMMAND_RENAME_CURRENT_USERDATA, renameCurrentUserdata),
  );
  subscribe(
    ui.registerCommand(COMMAND_SHOW_CURRENT_USERDATA, async () => {
      await ui.showInformationMessage(
        `Current ${host.displayName} Userdata: ${formatUserdataLabel(currentUserdata())}`,
      );
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_REVEAL_CURRENT_USERDATA, revealCurrentUserdata),
  );
  subscribe(ui.registerCommand(COMMAND_DELETE_USERDATA, deleteUserdata));

  refreshStatusBar();
}
