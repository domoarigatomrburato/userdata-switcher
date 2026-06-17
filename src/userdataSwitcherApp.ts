import fs from "node:fs";
import {
  DELETE_IN_USE_MESSAGE,
  DELETE_TRASH_FAILURE_MESSAGE,
  describeDeleteUserdataBlockedReason,
  listDeletableManagedUserdatas,
} from "./deleteUserdata";
import type { CurrentUserdata } from "./detect";
import { EditorHostSession } from "./editorHostSession";
import { listMainSocketPaths, probeRunningUserdataInstance } from "./editorIpc";
import type { SupportedHostAdapter } from "./host";
import {
  formatOpenWithUserdataPickerTitle,
  formatStatusBarText,
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
  buildOpenWithUserdataMenuItems,
  resolveOpenWithUserdataMenuIntent,
  type UserdataMenuItem,
  type UserdataMenuItemIntent,
} from "./menu";
import { registryPath, resolveManagedDataDir } from "./paths";
import {
  type Registry,
  removeUserdata,
  renameUserdata,
  type UserdataEntry,
} from "./registry";
import { UserdataRegistryStore } from "./registryStore";

export const COMMAND_OPEN_WITH_USERDATA = "userdataSwitcher.openWithUserdata";
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
  creationMode?: UserdataCreationMode;
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
  showErrorMessage(message: string): PromiseLike<unknown>;
  showWarningMessage(
    message: string,
    ...items: string[]
  ): PromiseLike<string | undefined>;
  showInformationMessage(message: string): PromiseLike<unknown>;
  revealPathInOs(fsPath: string): PromiseLike<unknown>;
  deletePath(fsPath: string, options: { useTrash: boolean }): PromiseLike<void>;
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
}

type UserdataCreationMode = "seedCurrent" | "empty";

const CREATE_FROM_CURRENT_SETTINGS_LABEL = "Start from current settings";
const CREATE_EMPTY_LABEL = "Start empty";

const USERDATA_CREATION_MODE_ITEMS: readonly QuickPickItem[] = [
  {
    label: CREATE_FROM_CURRENT_SETTINGS_LABEL,
    description: "Recommended",
    creationMode: "seedCurrent",
  },
  {
    label: CREATE_EMPTY_LABEL,
    description: "Fresh editor defaults",
    creationMode: "empty",
  },
];

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
      (await probeRunningUserdataInstance(managedUserdataRoot, {
        editorVersion,
      })) === "running",
  } = input;

  const storeRoot = host.resolveStoreRoot();
  const defaultUserdataRoot = host.resolveDefaultUserdataRoot();
  const registryFile = registryPath(storeRoot);
  const registryStore = new UserdataRegistryStore(registryFile);
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
  statusBarItem.command = COMMAND_OPEN_WITH_USERDATA;

  const refreshStatusBar = (registry?: Registry) => {
    const current = currentUserdata(registry);
    statusBarItem.text = formatStatusBarText(current);
    statusBarItem.tooltip = `Current ${host.displayName} Userdata: ${formatUserdataLabel(current)}`;
    statusBarItem.show();
  };

  const revealCurrentUserdata = async () => {
    const current = currentUserdata();
    const derivedRoot = session.derivedUserdataRoot();
    const userdataRoot = session.currentUserdataRoot(current);

    logger?.info(
      `Reveal diagnostics current=${describeCurrentUserdata(current)}`,
    );
    logger?.info(`Reveal diagnostics globalStoragePath=${globalStoragePath}`);
    logger?.info(
      `Reveal diagnostics derivedRootFromGlobalStorage=${derivedRoot ?? "(none)"}`,
    );
    logger?.info(`Reveal diagnostics storeRoot=${storeRoot}`);
    logger?.info(
      `Reveal diagnostics defaultUserdataRoot=${defaultUserdataRoot}`,
    );
    logger?.info(
      `Reveal diagnostics resolvedUserdataRoot=${userdataRoot ?? "(none)"}`,
    );
    if (userdataRoot) {
      logger?.info(
        `Reveal diagnostics resolvedPathExists=${fs.existsSync(userdataRoot)}`,
      );
    }

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
      await ui.showErrorMessage(message);
    }
  };

  const pickUserdataCreationMode = async (): Promise<
    UserdataCreationMode | undefined
  > => {
    const selected = await ui.showQuickPick(USERDATA_CREATION_MODE_ITEMS, {
      title: "Create Userdata",
      placeHolder: "Choose how to initialize the new userdata",
    });
    return selected?.creationMode;
  };

  const createUserdata = async () => {
    const creationMode = await pickUserdataCreationMode();
    if (!creationMode) {
      logger?.info("Create userdata cancelled");
      return;
    }
    const sourceUserdataRoot =
      creationMode === "seedCurrent"
        ? (session.currentUserdataRoot(currentUserdata()) ?? undefined)
        : undefined;
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

  const renameCurrentUserdata = async () => {
    const current = currentUserdata();
    if (current.kind === "unmanaged") {
      await ui.showWarningMessage(
        "The current window is using unmanaged userdata.",
      );
      return;
    }
    const label = await ui.showInputBox({
      title: "Rename Current Userdata",
      prompt: "Enter a new label",
      value: current.entry.label,
      validateInput: requireNonEmptyLabel,
    });
    if (!label) {
      logger?.info("Rename userdata cancelled");
      return;
    }
    const updatedRegistry = registryStore.update((latest) =>
      renameUserdata(latest, current.entry.id, label),
    );
    refreshStatusBar(updatedRegistry);
    logger?.info(`Renamed userdata ${current.entry.id} to ${label}`);
  };

  const deleteUserdata = async () => {
    const currentRegistry = registryStore.read();
    const current = currentUserdata(currentRegistry);
    const deletable = listDeletableManagedUserdatas(currentRegistry, current);
    const blockedReason = describeDeleteUserdataBlockedReason(
      currentRegistry,
      current,
    );

    if (blockedReason) {
      await ui.showWarningMessage(blockedReason);
      return;
    }

    const items: QuickPickItem[] = deletable.map((entry) => ({
      label: formatUserdataLabel({ kind: "known", entry }),
      description: entry.relativeDataDir ? `u/${entry.id}` : undefined,
      intent: { kind: "open", userdataId: entry.id },
    }));

    const selected = await ui.showQuickPick(items, {
      title: "Delete Userdata",
      placeHolder: "Select a userdata to delete",
    });

    if (selected?.intent?.kind !== "open") {
      logger?.info("Delete userdata cancelled");
      return;
    }

    const targetId = selected.intent.userdataId;
    const targetEntry = deletable.find((entry) => entry.id === targetId);
    if (!targetEntry?.relativeDataDir) {
      return;
    }

    const confirm = await ui.showWarningMessage(
      `Are you sure you want to delete userdata "${targetEntry.label}"? Close all windows using it first. This will move its settings and data files to the trash.`,
      "Delete",
      "Cancel",
    );

    if (confirm !== "Delete") {
      logger?.info("Delete userdata cancelled by user confirmation");
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

    const socketCandidates = listMainSocketPaths(targetPath, editorVersion);
    logger?.info(
      `Delete preflight socket candidates: ${
        socketCandidates.length > 0 ? socketCandidates.join(", ") : "(none)"
      }`,
    );

    if (await isManagedUserdataInUse(targetPath)) {
      logger?.info(
        `Delete userdata blocked: ${targetEntry.id} still has a running editor instance`,
      );
      await ui.showWarningMessage(DELETE_IN_USE_MESSAGE);
      return;
    }

    try {
      await ui.deletePath(targetPath, { useTrash: true });
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger?.error(`Delete userdata files failed: ${message}`);
      await ui.showWarningMessage(DELETE_TRASH_FAILURE_MESSAGE);
    }
  };

  const openWithUserdataMenu = async () => {
    const currentRegistry = registryStore.read();
    const current = currentUserdata(currentRegistry);
    logger?.info(
      `Opening menu from current userdata: ${formatUserdataLabel(current)}`,
    );
    refreshStatusBar(currentRegistry);
    const items = toQuickPickItems(
      buildOpenWithUserdataMenuItems(currentRegistry, current),
      ui.QuickPickItemKind.Separator,
    );

    const selected = await ui.showQuickPick(items, {
      title: formatOpenWithUserdataPickerTitle(current),
      placeHolder: "Select a userdata to open",
    });
    const intent = resolveOpenWithUserdataMenuIntent(currentRegistry, selected);
    switch (intent.kind) {
      case "cancel":
        logger?.info("Menu cancelled");
        return;
      case "create":
        logger?.info("Menu intent: create userdata");
        await createUserdata();
        return;
      case "rename":
        logger?.info("Menu intent: rename current userdata");
        await renameCurrentUserdata();
        return;
      case "reveal":
        logger?.info("Menu intent: reveal current userdata");
        await revealCurrentUserdata();
        return;
      case "delete":
        logger?.info("Menu intent: delete userdata");
        await deleteUserdata();
        return;
      case "open":
        logger?.info(`Menu intent: open userdata ${intent.entry.id}`);
        await launchEntrySafely(intent.entry);
        return;
    }
  };

  subscribe(statusBarItem as unknown as Disposable);
  subscribe(
    ui.registerCommand(COMMAND_OPEN_WITH_USERDATA, openWithUserdataMenu),
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

function describeCurrentUserdata(current: CurrentUserdata): string {
  if (current.kind === "unmanaged") {
    return "kind=unmanaged";
  }

  const { entry } = current;
  const relativeDataDir = entry.relativeDataDir ?? "(none)";
  return `kind=known id=${entry.id} entryKind=${entry.kind} relativeDataDir=${relativeDataDir}`;
}
