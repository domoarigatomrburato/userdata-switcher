import vscode from "vscode";
import {
  activateUserdataSwitcher,
  type Disposable,
  type QuickPickItem,
  type StatusBarItem,
  type UserdataSwitcherUi,
} from "./extensionActivation";
import { resolveEditorHost } from "./host";

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

  activateUserdataSwitcher({
    host,
    globalStoragePath: context.globalStorageUri.fsPath,
    appRoot: vscode.env.appRoot,
    workspace: vscode.workspace,
    subscribe: (disposable) => {
      context.subscriptions.push(disposable as vscode.Disposable);
    },
    ui: createVscodeUi(),
  });
}

export function deactivate(): void {}

function createVscodeUi(): UserdataSwitcherUi {
  return {
    StatusBarAlignment: vscode.StatusBarAlignment,
    QuickPickItemKind: vscode.QuickPickItemKind,
    createStatusBarItem: (alignment, priority) =>
      vscode.window.createStatusBarItem(
        alignment,
        priority,
      ) as unknown as StatusBarItem,
    registerCommand: (command, callback) =>
      vscode.commands.registerCommand(
        command,
        callback,
      ) as unknown as Disposable,
    showQuickPick: (items, options) =>
      vscode.window.showQuickPick(
        items as vscode.QuickPickItem[],
        options,
      ) as PromiseLike<QuickPickItem | undefined>,
    showInputBox: (options) => vscode.window.showInputBox(options),
    showErrorMessage: (message) => vscode.window.showErrorMessage(message),
    showWarningMessage: (message) => vscode.window.showWarningMessage(message),
    showInformationMessage: (message) =>
      vscode.window.showInformationMessage(message),
    executeCommand: (command, ...args) =>
      vscode.commands.executeCommand(command, ...args),
  };
}
