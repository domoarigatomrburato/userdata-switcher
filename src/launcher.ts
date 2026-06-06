import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { EditorHost } from "./host";
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

interface CliDiscoveryDeps {
  env?: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  platform?: NodeJS.Platform;
}

export function discoverBundledCli(
  host: EditorHost,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  return findExecutableInDirectories({
    directories: [
      pathForPlatform(deps.platform ?? process.platform).join(appRoot, "bin"),
    ],
    env: deps.env ?? process.env,
    existsSync: deps.existsSync,
    names: host.cliNames,
    platform: deps.platform ?? process.platform,
  });
}

export function discoverEditorCli(
  host: EditorHost,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  const bundledCli = discoverBundledCli(host, appRoot, deps);
  if (bundledCli) {
    return bundledCli;
  }
  return findEditorOnPath({
    env: deps.env ?? process.env,
    existsSync: deps.existsSync,
    names: host.cliNames,
    platform: deps.platform ?? process.platform,
  });
}

function findEditorOnPath(input: {
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  names: string[];
  platform: NodeJS.Platform;
}): string | null {
  const pathValue = input.env.PATH ?? input.env.Path ?? input.env.path;
  if (!pathValue) {
    return null;
  }
  const delimiter = input.platform === "win32" ? ";" : ":";
  return findExecutableInDirectories({
    directories: pathValue.split(delimiter).filter(Boolean),
    env: input.env,
    existsSync: input.existsSync,
    names: input.names,
    platform: input.platform,
  });
}

function findExecutableInDirectories(input: {
  directories: string[];
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  names: string[];
  platform: NodeJS.Platform;
}): string | null {
  const extensions = executableExtensions(input.platform, input.env);
  const pathApi = pathForPlatform(input.platform);

  for (const directory of input.directories) {
    for (const name of input.names) {
      for (const extension of extensions) {
        const candidate = pathApi.join(directory, `${name}${extension}`);
        if (input.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function executableExtensions(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform !== "win32") {
    return [""];
  }
  return (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
    .map((extension) => extension.toLowerCase());
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
    command: input.editorCli,
    args,
  };
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

function pathForPlatform(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}
