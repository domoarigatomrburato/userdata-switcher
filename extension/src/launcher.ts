import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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

export function discoverBundledCli(
  appRoot: string,
  deps: { existsSync: (candidate: string) => boolean } = fs,
): string | null {
  const candidate = path.join(appRoot, "bin", "cursor");
  return deps.existsSync(candidate) ? candidate : null;
}

export function resolveWorkspaceArg(workspace: WorkspaceShape): string | undefined {
  if (workspace.workspaceFile?.fsPath) {
    return workspace.workspaceFile.fsPath;
  }
  const folders = workspace.workspaceFolders ?? [];
  if (folders.length === 1) {
    return folders[0]?.uri.fsPath;
  }
  return undefined;
}

export function buildLaunchCommand(input: {
  entry: UserdataEntry;
  storeRoot: string;
  workspacePath?: string;
  bundledCli: string;
  reuseWindow?: boolean;
}): LaunchCommand {
  const args: string[] = [];

  if (input.entry.kind === "managed" && input.entry.relativeDataDir) {
    args.push(
      "--user-data-dir",
      resolveManagedDataDir(input.storeRoot, input.entry.relativeDataDir),
    );
    if (input.reuseWindow) {
      args.push("--reuse-window");
    }
  }

  if (input.workspacePath) {
    args.push(input.workspacePath);
  }

  return {
    command: input.bundledCli,
    args,
  };
}

export function launchCursor(command: LaunchCommand): void {
  const child = spawn(command.command, command.args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
