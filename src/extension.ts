import vscode from "vscode";
import { resolveEditorHost } from "./host";
import type { LaunchLogger } from "./launcher";
import {
  activateUserdataSwitcher,
  type Disposable,
  type QuickPickItem,
  type StatusBarItem,
  type UserdataSwitcherUi,
} from "./userdataSwitcherApp";

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel("Userdata Switcher");
  context.subscriptions.push(outputChannel);
  const logger = createOutputChannelLogger(outputChannel);

  const host = resolveEditorHost({
    appName: vscode.env.appName,
    uriScheme: vscode.env.uriScheme,
  });
  if (!host) {
    logger.error(`Unsupported editor host: ${vscode.env.appName}`);
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
      context.subscriptions.push(disposable);
    },
    ui: createVscodeUi(logger),
    logger,
  });
}

export function deactivate(): void {}

export function createVscodeUi(logger: LaunchLogger): UserdataSwitcherUi {
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
    revealPathInOs: async (fsPath) => {
      const uri = vscode.Uri.file(fsPath);
      logger.info(`revealFileInOS input.fsPath=${JSON.stringify(fsPath)}`);
      logger.info(`revealFileInOS uri.fsPath=${JSON.stringify(uri.fsPath)}`);
      logger.info(`revealFileInOS uri.toString()=${uri.toString()}`);
      try {
        await vscode.commands.executeCommand("revealFileInOS", uri);
        logger.info("revealFileInOS completed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`revealFileInOS failed: ${message}`);
        throw error;
      }
    },
  };
}

function createOutputChannelLogger(
  outputChannel: vscode.OutputChannel,
): LaunchLogger {
  return {
    error: (message) => {
      outputChannel.appendLine(formatLogLine("error", message));
      outputChannel.show(true);
    },
    info: (message) => {
      outputChannel.appendLine(formatLogLine("info", message));
    },
  };
}

function formatLogLine(level: "error" | "info", message: string): string {
  return `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}`;
}
