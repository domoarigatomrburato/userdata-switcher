import fs from "node:fs";
import { type CurrentUserdata, matchCurrentUserdata } from "./detect";
import type { SupportedHostAdapter } from "./host";
import {
  formatOpenWithUserdataPickerTitle,
  formatStatusBarText,
  formatUserdataLabel,
} from "./labels";
import {
  type LaunchEditor,
  openWithUserdata,
  type WorkspaceShape,
} from "./launcher";
import { buildOpenWithUserdataMenuItems } from "./menu";

export {
  CREATE_USERDATA_LABEL,
  RENAME_CURRENT_USERDATA_LABEL,
} from "./menu";

import { registryPath, resolveManagedDataDir } from "./paths";
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

export interface QuickPickItem {
  label: string;
  description?: string;
  kind?: number;
  action?: "create" | "rename";
  userdataId?: string;
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
}

export interface UserdataSwitcherActivation {
  host: SupportedHostAdapter;
  globalStoragePath: string;
  appRoot: string;
  workspace: WorkspaceShape;
  subscribe(disposable: Disposable): void;
  ui: UserdataSwitcherUi;
  launchEditorImpl?: LaunchEditor;
  mkdirSync?: typeof fs.mkdirSync;
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
    launchEditorImpl,
    mkdirSync,
  } = input;
  const mkdir = mkdirSync ?? fs.mkdirSync;

  const storeRoot = host.resolveStoreRoot();
  const defaultUserdataRoot = host.resolveDefaultUserdataRoot();
  const registryFile = registryPath(storeRoot);

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

  const launchEntrySafely = async (entry: UserdataEntry) => {
    try {
      await openWithUserdata({
        entry,
        host,
        appRoot,
        storeRoot,
        workspace,
        launchEditorImpl,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ui.showErrorMessage(message);
    }
  };

  subscribe(statusBarItem as unknown as Disposable);
  subscribe(
    ui.registerCommand(COMMAND_OPEN_WITH_USERDATA, async () => {
      const currentRegistry = refreshRegistry();
      const current = getCurrent(currentRegistry);
      const items = buildOpenWithUserdataMenuItems(
        currentRegistry,
        current,
      ).map((item) => {
        if (item.kind === "separator") {
          return { label: item.label, kind: ui.QuickPickItemKind.Separator };
        }
        const { kind: _kind, ...quickPickItem } = item;
        return quickPickItem;
      });

      const selected = await ui.showQuickPick(items, {
        title: formatOpenWithUserdataPickerTitle(current),
        placeHolder: "Select a userdata to open",
      });
      if (!selected || selected.kind === ui.QuickPickItemKind.Separator) {
        return;
      }
      switch (selected.action) {
        case "create":
          await ui.executeCommand(COMMAND_CREATE_USERDATA);
          return;
        case "rename":
          await ui.executeCommand(COMMAND_RENAME_CURRENT_USERDATA);
          return;
      }
      const entry = currentRegistry.userdatas.find(
        (candidate) => candidate.id === selected.userdataId,
      );
      if (!entry) {
        return;
      }
      await launchEntrySafely(entry);
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_CREATE_USERDATA, async () => {
      const label = await ui.showInputBox({
        title: "Create Userdata",
        prompt: `Enter a label for the new ${host.displayName} Userdata`,
        placeHolder: "Personal",
        validateInput: (value) =>
          value.trim() ? undefined : "Label is required",
      });
      if (!label) {
        return;
      }
      const { entry: created, registry: updated } = createManagedUserdata(
        registryFile,
        label,
      );
      registry = updated;
      refreshStatusBar();
      mkdir(resolveManagedDataDir(storeRoot, created.relativeDataDir), {
        recursive: true,
      });
      await launchEntrySafely(created);
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
        validateInput: (value) =>
          value.trim() ? undefined : "Label is required",
      });
      if (!label) {
        return;
      }
      persistRegistry((latest) =>
        renameUserdata(latest, current.entry.id, label),
      );
    }),
  );
  subscribe(
    ui.registerCommand(COMMAND_SHOW_CURRENT_USERDATA, async () => {
      await ui.showInformationMessage(
        `Current ${host.displayName} Userdata: ${formatUserdataLabel(getCurrent())}`,
      );
    }),
  );

  refreshStatusBar();
}
