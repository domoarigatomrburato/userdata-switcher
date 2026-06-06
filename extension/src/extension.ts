import fs from "node:fs";
import vscode from "vscode";
import { matchCurrentUserdata } from "./detect";
import { formatStatusBarText, formatUserdataLabel } from "./labels";
import {
  buildLaunchCommand,
  discoverBundledCli,
  launchCursor,
  resolveWorkspaceArg,
} from "./launcher";
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
  renameUserdata,
  saveRegistry,
  type Registry,
  type UserdataEntry,
} from "./registry";

const CREATE_USERDATA_LABEL = "Create New Userdata...";

type UserdataQuickPickItem = vscode.QuickPickItem & {
  userdataId?: string;
  isCurrent?: boolean;
};

export function activate(context: vscode.ExtensionContext): void {
  const storeRoot = resolveStoreRoot();
  const defaultUserdataRoot = resolveDefaultUserdataRoot();
  const registryFile = registryPath(storeRoot);

  let registry = ensureDefaultUserdata(loadRegistry(registryFile));
  saveRegistry(registryFile, registry);

  const getCurrent = () =>
    getCurrentEntry(context, registry, storeRoot, defaultUserdataRoot);

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  statusBarItem.command = "cursorUserdata.openWithUserdata";

  const refreshStatusBar = () => {
    const current = getCurrent();
    statusBarItem.text = formatStatusBarText(current);
    statusBarItem.tooltip = current
      ? `Current Cursor Userdata: ${formatUserdataLabel(current)}`
      : "Current Cursor Userdata: Unmanaged";
    statusBarItem.show();
  };

  const persistRegistry = (next: Registry) => {
    registry = next;
    saveRegistry(registryFile, registry);
    refreshStatusBar();
  };

  const launchEntry = async (entry: UserdataEntry) => {
    const bundledCli = discoverBundledCli(vscode.env.appRoot);
    if (!bundledCli) {
      throw new Error("Could not find Cursor bundled CLI in this installation.");
    }
    launchCursor(
      buildLaunchCommand({
        entry,
        storeRoot,
        workspacePath: resolveWorkspaceArg(vscode.workspace),
        bundledCli,
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
    vscode.commands.registerCommand("cursorUserdata.openWithUserdata", async () => {
      const current = getCurrent();
      const items: UserdataQuickPickItem[] = [
        {
          label: formatUserdataLabel(current),
          description: "Current",
          detail: "Selecting the current userdata does nothing.",
          isCurrent: true,
        },
        ...registry.userdatas
          .filter((entry) => entry.id !== current?.id)
          .map((entry) => ({
            label: formatUserdataLabel(entry),
            description: entry.kind === "default" ? "Default Userdata" : "Managed Userdata",
            userdataId: entry.id,
          })),
        {
          label: CREATE_USERDATA_LABEL,
          alwaysShow: true,
        },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        title: "Open With Userdata",
        placeHolder: "Select a Cursor Userdata to open",
      });
      if (!selected || selected.isCurrent) {
        return;
      }
      if (selected.label === CREATE_USERDATA_LABEL) {
        await vscode.commands.executeCommand("cursorUserdata.createUserdata");
        return;
      }
      const entry = registry.userdatas.find((candidate) => candidate.id === selected.userdataId);
      if (!entry) {
        return;
      }
      await launchEntrySafely(entry);
    }),
    vscode.commands.registerCommand("cursorUserdata.createUserdata", async () => {
      const label = await vscode.window.showInputBox({
        title: "Create Userdata",
        prompt: "Enter a label for the new Cursor Userdata",
        placeHolder: "Personal",
        validateInput: (value) => (value.trim() ? undefined : "Label is required"),
      });
      if (!label) {
        return;
      }
      const updated = addManagedUserdata(registry, label);
      const created = updated.userdatas.at(-1);
      if (!created?.relativeDataDir) {
        return;
      }
      fs.mkdirSync(resolveManagedDataDir(storeRoot, created.relativeDataDir), { recursive: true });
      persistRegistry(updated);
      await launchEntrySafely(created);
    }),
    vscode.commands.registerCommand("cursorUserdata.renameCurrentUserdata", async () => {
      const current = getCurrent();
      if (!current) {
        await vscode.window.showWarningMessage("The current window is using unmanaged userdata.");
        return;
      }
      const label = await vscode.window.showInputBox({
        title: "Rename Current Userdata",
        prompt: "Enter a new label",
        value: current.label,
        validateInput: (value) => (value.trim() ? undefined : "Label is required"),
      });
      if (!label) {
        return;
      }
      persistRegistry(renameUserdata(registry, current.id, label));
    }),
    vscode.commands.registerCommand("cursorUserdata.showCurrentUserdata", async () => {
      const current = getCurrent();
      if (!current) {
        await vscode.window.showInformationMessage("Current Cursor Userdata: Unmanaged");
        return;
      }
      await vscode.window.showInformationMessage(
        `Current Cursor Userdata: ${formatUserdataLabel(current)}`,
      );
    }),
  );

  refreshStatusBar();
}

function getCurrentEntry(
  context: vscode.ExtensionContext,
  registry: Registry,
  storeRoot: string,
  defaultUserdataRoot: string,
): UserdataEntry | null {
  const match = matchCurrentUserdata({
    globalStoragePath: context.globalStorageUri.fsPath,
    defaultUserdataRoot,
    storeRoot,
    registry,
  });
  return match.kind === "known" ? match.entry : null;
}

export function deactivate(): void {}
