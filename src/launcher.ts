import { spawn } from "node:child_process";
import type { SupportedHostAdapter } from "./host";
import { resolveManagedDataDir } from "./paths";
import type { UserdataEntry } from "./registry";

export interface WorkspaceShape {
  workspaceFolders?: ReadonlyArray<{ uri: { fsPath: string } }>;
  workspaceFile?: { fsPath: string };
}

export interface LaunchCommand {
  command: string;
  args: string[];
}

export type LaunchEditor = (command: LaunchCommand) => Promise<void>;

interface SpawnedEditorProcess {
  once(event: "error", listener: (error: Error) => void): this;
  once(event: "spawn", listener: () => void): this;
  unref(): void;
}

interface LaunchDeps {
  spawn(
    command: string,
    args: string[],
    options: { detached: true; stdio: "ignore" },
  ): SpawnedEditorProcess;
}

export function resolveWorkspaceArg(
  workspace: WorkspaceShape,
): string | undefined {
  if (workspace.workspaceFile?.fsPath) {
    return workspace.workspaceFile.fsPath;
  }
  const folders = workspace.workspaceFolders ?? [];
  return folders.length === 1 ? folders[0]?.uri.fsPath : undefined;
}

export function buildLaunchCommand(input: {
  entry: UserdataEntry;
  storeRoot: string;
  workspacePath?: string;
  editorCli: string;
  reuseWindow?: boolean;
  sharedExtensionsDirectory?: string | null;
}): LaunchCommand {
  const args: string[] = [];

  if (input.entry.kind === "managed" && input.entry.relativeDataDir) {
    args.push(
      "--user-data-dir",
      resolveManagedDataDir(input.storeRoot, input.entry.relativeDataDir),
    );
    if (input.sharedExtensionsDirectory) {
      args.push("--extensions-dir", input.sharedExtensionsDirectory);
    }
    if (input.reuseWindow) {
      args.push("--reuse-window");
    }
  }

  if (input.workspacePath) {
    args.push(input.workspacePath);
  }

  return {
    command: input.editorCli,
    args,
  };
}

export function buildOpenWithUserdataCommand(input: {
  entry: UserdataEntry;
  host: SupportedHostAdapter;
  appRoot: string;
  storeRoot: string;
  workspace: WorkspaceShape;
}): LaunchCommand {
  const editorCli = input.host.discoverEditorCli(input.appRoot);
  if (!editorCli) {
    throw new Error(
      `Could not find ${input.host.displayName} CLI in this installation.`,
    );
  }

  return buildLaunchCommand({
    entry: input.entry,
    storeRoot: input.storeRoot,
    workspacePath: resolveWorkspaceArg(input.workspace),
    editorCli,
    reuseWindow: input.entry.kind === "managed",
    sharedExtensionsDirectory:
      input.entry.kind === "managed"
        ? input.host.resolveSharedExtensionsDirectory()
        : null,
  });
}

export async function openWithUserdata(input: {
  entry: UserdataEntry;
  host: SupportedHostAdapter;
  appRoot: string;
  storeRoot: string;
  workspace: WorkspaceShape;
  launchEditorImpl?: LaunchEditor;
}): Promise<void> {
  const launch = input.launchEditorImpl ?? launchEditor;
  await launch(buildOpenWithUserdataCommand(input));
}

export function launchEditor(
  command: LaunchCommand,
  deps: LaunchDeps = { spawn },
): Promise<void> {
  return new Promise((resolve, reject) => {
    let child: SpawnedEditorProcess;
    try {
      child = deps.spawn(command.command, command.args, {
        detached: true,
        stdio: "ignore",
      });
    } catch (error) {
      reject(error);
      return;
    }

    let settled = false;
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("spawn", () => {
      if (!settled) {
        settled = true;
        child.unref();
        resolve();
      }
    });
  });
}
