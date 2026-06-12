import fs from "node:fs";
import {
  type CurrentUserdata,
  deriveUserdataRootFromGlobalStorage,
  matchCurrentUserdata,
  resolveCurrentUserdataRoot,
} from "./detect";
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
import {
  buildOpenWithUserdataMenuItems,
  resolveOpenWithUserdataMenuIntent,
  type UserdataMenuItem,
  type UserdataMenuItemIntent,
} from "./menu";
import { registryPath, resolveManagedDataDir } from "./paths";
import { seedUserdataPreferences } from "./preferences";
import {
  createManagedUserdata,
  ensureDefaultUserdata,
  loadRegistry,
  type Registry,
  renameUserdata,
  type UserdataEntry,
  updateRegistry,
} from "./registry";

export const COMMAND_OPEN_WITH_USERDATA = "userdataSwitcher.openWithUserdata";
export const COMMAND_CREATE_USERDATA = "userdataSwitcher.createUserdata";
export const COMMAND_RENAME_CURRENT_USERDATA =
  "userdataSwitcher.renameCurrentUserdata";
export const COMMAND_SHOW_CURRENT_USERDATA =
  "userdataSwitcher.showCurrentUserdata";
export const COMMAND_REVEAL_CURRENT_USERDATA =
  "userdataSwitcher.revealCurrentUserdata";

export {
  CREATE_USERDATA_LABEL,
  RENAME_CURRENT_USERDATA_LABEL,
} from "./menu";

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
  showWarningMessage(message: string): PromiseLike<unknown>;
  showInformationMessage(message: string): PromiseLike<unknown>;
  executeCommand(command: string, ...args: unknown[]): PromiseLike<unknown>;
  revealPathInOs(fsPath: string): PromiseLike<unknown>;
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
  } = input;
  const mkdir = mkdirSync ?? fs.mkdirSync;

  const storeRoot = host.resolveStoreRoot();
  const defaultUserdataRoot = host.resolveDefaultUserdataRoot();
  const registryFile = registryPath(storeRoot);

  logger?.info(`Activated for ${host.displayName}`);
  logger?.info(`appRoot=${appRoot}`);
  logger?.info(`globalStoragePath=${globalStoragePath}`);
  logger?.info(`storeRoot=${storeRoot}`);
  logger?.info(`defaultUserdataRoot=${defaultUserdataRoot}`);
  logger?.info(`registryFile=${registryFile}`);

  let registry = updateRegistry(registryFile, (latest) => latest);

  const refreshRegistry = (): Registry => {
    registry = ensureDefaultUserdata(loadRegistry(registryFile));
    return registry;
  };

  const getCurrent = (currentRegistry: Registry = registry): CurrentUserdata =>
    matchCurrentUserdata({
      globalStoragePath,
      defaultUserdataRoot,
      storeRoot,
      registry: currentRegistry,
    });

  const statusBarItem = ui.createStatusBarItem(ui.StatusBarAlignment.Left, 100);
  statusBarItem.command = COMMAND_OPEN_WITH_USERDATA;

  const refreshStatusBar = () => {
    const current = getCurrent();
    statusBarItem.text = formatStatusBarText(current);
    statusBarItem.tooltip = `Current ${host.displayName} Userdata: ${formatUserdataLabel(current)}`;
    statusBarItem.show();
  };

  const persistRegistry = (
    update: (latest: Registry) => Registry,
  ): Registry => {
    registry = updateRegistry(registryFile, update);
    refreshStatusBar();
    return registry;
  };

  const revealCurrentUserdata = async () => {
    const current = getCurrent();
    const derivedRoot = deriveUserdataRootFromGlobalStorage(globalStoragePath);
    const userdataRoot = resolveCurrentUserdataRoot({
      current,
      globalStoragePath,
      defaultUserdataRoot,
      storeRoot,
    });

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

  subscribe(statusBarItem as unknown as Disposable);
  subscribe(
    ui.registerCommand(COMMAND_OPEN_WITH_USERDATA, async () => {
      const currentRegistry = refreshRegistry();
      const current = getCurrent(currentRegistry);
      logger?.info(
        `Opening menu from current userdata: ${formatUserdataLabel(current)}`,
      );
      const items = toQuickPickItems(
        buildOpenWithUserdataMenuItems(currentRegistry, current),
        ui.QuickPickItemKind.Separator,
      );

      const selected = await ui.showQuickPick(items, {
        title: formatOpenWithUserdataPickerTitle(current),
        placeHolder: "Select a userdata to open",
      });
      const intent = resolveOpenWithUserdataMenuIntent(
        currentRegistry,
        selected,
      );
      switch (intent.kind) {
        case "cancel":
          logger?.info("Menu cancelled");
          return;
        case "create":
          logger?.info("Menu intent: create userdata");
          await ui.executeCommand(COMMAND_CREATE_USERDATA);
          return;
        case "rename":
          logger?.info("Menu intent: rename current userdata");
          await ui.executeCommand(COMMAND_RENAME_CURRENT_USERDATA);
          return;
        case "reveal":
          logger?.info("Menu intent: reveal current userdata");
          await ui.executeCommand(COMMAND_REVEAL_CURRENT_USERDATA);
          return;
        case "open":
          logger?.info(`Menu intent: open userdata ${intent.entry.id}`);
          await launchEntrySafely(intent.entry);
          return;
      }
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_CREATE_USERDATA, async () => {
      const creationMode = await pickUserdataCreationMode();
      if (!creationMode) {
        logger?.info("Create userdata cancelled");
        return;
      }
      const sourceUserdataRoot =
        creationMode === "seedCurrent"
          ? resolveCurrentUserdataRoot({
              current: getCurrent(refreshRegistry()),
              globalStoragePath,
              defaultUserdataRoot,
              storeRoot,
            })
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
        const { entry: created, registry: updated } = createManagedUserdata(
          registryFile,
          label,
          {
            beforeSave: (entry) => {
              let sourceRootToSeed: string | undefined;
              if (creationMode === "seedCurrent") {
                if (!sourceUserdataRoot) {
                  throw new Error(
                    "Could not determine the current userdata directory to copy settings from.",
                  );
                }
                sourceRootToSeed = sourceUserdataRoot;
              }
              const managedDataDir = resolveManagedDataDir(
                storeRoot,
                entry.relativeDataDir,
              );
              mkdir(managedDataDir, {
                recursive: true,
              });
              if (sourceRootToSeed) {
                seedUserdataPreferences({
                  sourceUserdataRoot: sourceRootToSeed,
                  targetUserdataRoot: managedDataDir,
                });
              }
            },
          },
        );
        const managedDataDir = resolveManagedDataDir(
          storeRoot,
          created.relativeDataDir,
        );
        registry = updated;
        refreshStatusBar();
        logger?.info(
          `Created managed userdata ${created.id}: ${managedDataDir}`,
        );
        await launchEntrySafely(created);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error(`Create userdata failed: ${message}`);
        await ui.showErrorMessage(message);
      }
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_RENAME_CURRENT_USERDATA, async () => {
      const current = getCurrent();
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
      persistRegistry((latest) =>
        renameUserdata(latest, current.entry.id, label),
      );
      logger?.info(`Renamed userdata ${current.entry.id} to ${label}`);
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_SHOW_CURRENT_USERDATA, async () => {
      await ui.showInformationMessage(
        `Current ${host.displayName} Userdata: ${formatUserdataLabel(getCurrent())}`,
      );
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_REVEAL_CURRENT_USERDATA, revealCurrentUserdata),
  );

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
