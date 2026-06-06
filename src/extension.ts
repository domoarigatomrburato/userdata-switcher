import fs from "node:fs";
import vscode from "vscode";
import { matchCurrentUserdata } from "./detect";
import { resolveEditorHost } from "./host";
import {
  formatOpenWithUserdataPickerTitle,
  formatStatusBarText,
  formatUserdataLabel,
} from "./labels";
import {
  buildLaunchCommand,
  discoverEditorCli,
  launchEditor,
  resolveWorkspaceArg,
} from "./launcher";
import { buildOpenWithUserdataMenuItems, type UserdataMenuItem } from "./menu";
import {
  registryPath,
  resolveDefaultUserdataRoot,
  resolveManagedDataDir,
  resolveStoreRoot,
} from "./paths";
import {
  addManagedUserdata,
  ensureDefaultUserdata,
  loadRegistry,
  type Registry,
  renameUserdata,
  type UserdataEntry,
  updateRegistry,
} from "./registry";

const CREATE_USERDATA_LABEL = "Create New Userdata...";
const COMMAND_OPEN_WITH_USERDATA = "userdataSwitcher.openWithUserdata";
const COMMAND_CREATE_USERDATA = "userdataSwitcher.createUserdata";
const COMMAND_RENAME_CURRENT_USERDATA =
  "userdataSwitcher.renameCurrentUserdata";
const COMMAND_SHOW_CURRENT_USERDATA = "userdataSwitcher.showCurrentUserdata";

type UserdataQuickPickItem = vscode.QuickPickItem & {
  action?: "create";
  userdataId?: string;
};

export function activate(context: vscode.ExtensionContext): void {
  const host = resolveEditorHost({
    appName: vscode.env.appName,
    uriScheme: vscode.env.uriScheme,
  });
  if (!host) {
    void vscode.window.showErrorMessage(
      `Unsupported editor host: ${vscode.env.appName}`,
    );
    return;
  }

  const storeRoot = resolveStoreRoot(host);
  const defaultUserdataRoot = resolveDefaultUserdataRoot(host);
  const registryFile = registryPath(storeRoot);

  let registry = updateRegistry(registryFile, (latest) => latest);

  const refreshRegistry = (): Registry => {
    registry = ensureDefaultUserdata(loadRegistry(registryFile));
    return registry;
  };

  const getCurrent = (
    currentRegistry: Registry = registry,
  ): UserdataEntry | null => {
    const match = matchCurrentUserdata({
      globalStoragePath: context.globalStorageUri.fsPath,
      defaultUserdataRoot,
      storeRoot,
      registry: currentRegistry,
    });
    return match.kind === "known" ? match.entry : null;
  };

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
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

  const launchEntry = async (entry: UserdataEntry) => {
    const editorCli = discoverEditorCli(host, vscode.env.appRoot);
    if (!editorCli) {
      throw new Error(
        `Could not find ${host.displayName} CLI in this installation.`,
      );
    }
    await launchEditor(
      buildLaunchCommand({
        entry,
        storeRoot,
        workspacePath: resolveWorkspaceArg(vscode.workspace),
        editorCli,
        reuseWindow: entry.kind === "managed",
      }),
    );
  };

  const launchEntrySafely = async (entry: UserdataEntry) => {
    try {
      await launchEntry(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(message);
    }
  };

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand(COMMAND_OPEN_WITH_USERDATA, async () => {
      const currentRegistry = refreshRegistry();
      const current = getCurrent(currentRegistry);
      const items = buildOpenWithUserdataMenuItems(
        currentRegistry,
        current,
        CREATE_USERDATA_LABEL,
      ).map(toQuickPickItem);

      const selected = await vscode.window.showQuickPick(items, {
        title: formatOpenWithUserdataPickerTitle(current),
        placeHolder: "Select a userdata to open",
      });
      if (!selected || selected.kind === vscode.QuickPickItemKind.Separator) {
        return;
      }
      if (selected.action === "create") {
        await vscode.commands.executeCommand(COMMAND_CREATE_USERDATA);
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
    vscode.commands.registerCommand(COMMAND_CREATE_USERDATA, async () => {
      const label = await vscode.window.showInputBox({
        title: "Create Userdata",
        prompt: `Enter a label for the new ${host.displayName} Userdata`,
        placeHolder: "Personal",
        validateInput: (value) =>
          value.trim() ? undefined : "Label is required",
      });
      if (!label) {
        return;
      }
      const updated = persistRegistry((latest) =>
        addManagedUserdata(latest, label),
      );
      const created = updated.userdatas.at(-1);
      if (!created?.relativeDataDir) {
        return;
      }
      fs.mkdirSync(resolveManagedDataDir(storeRoot, created.relativeDataDir), {
        recursive: true,
      });
      await launchEntrySafely(created);
    }),
    vscode.commands.registerCommand(
      COMMAND_RENAME_CURRENT_USERDATA,
      async () => {
        const current = getCurrent();
        if (!current) {
          await vscode.window.showWarningMessage(
            "The current window is using unmanaged userdata.",
          );
          return;
        }
        const label = await vscode.window.showInputBox({
          title: "Rename Current Userdata",
          prompt: "Enter a new label",
          value: current.label,
          validateInput: (value) =>
            value.trim() ? undefined : "Label is required",
        });
        if (!label) {
          return;
        }
        persistRegistry((latest) => renameUserdata(latest, current.id, label));
      },
    ),
    vscode.commands.registerCommand(COMMAND_SHOW_CURRENT_USERDATA, async () => {
      await vscode.window.showInformationMessage(
        `Current ${host.displayName} Userdata: ${formatUserdataLabel(getCurrent())}`,
      );
    }),
  );

  refreshStatusBar();
}

export function deactivate(): void {}

function toQuickPickItem(item: UserdataMenuItem): UserdataQuickPickItem {
  if (item.kind === "separator") {
    return { label: item.label, kind: vscode.QuickPickItemKind.Separator };
  }
  const { kind: _kind, ...quickPickItem } = item;
  return quickPickItem;
}
