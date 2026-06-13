import { spawn } from "node:child_process";
import type { SupportedHostAdapter } from "./host";
import { resolveManagedDataDir } from "./paths";
import type { UserdataEntry } from "./registry";

const MACOS_UNIX_SOCKET_PATH_LIMIT = 103;
const VSCODE_MAIN_SOCKET_BASENAME = "1.12-main.sock";

interface WorkspaceUri {
  fsPath: string;
  scheme?: string;
}

export interface WorkspaceShape {
  workspaceFolders?: ReadonlyArray<{
    uri: WorkspaceUri;
  }>;
  workspaceFile?: WorkspaceUri;
}

export interface LaunchCommand {
  command: string;
  args: string[];
}

export interface LaunchLogger {
  error(message: string): void;
  info(message: string): void;
}

export interface LaunchEditorOptions {
  logger?: LaunchLogger;
}

export type LaunchEditor = (
  command: LaunchCommand,
  options?: LaunchEditorOptions,
) => Promise<void>;

interface SpawnedEditorProcess {
  stderr?: { on(event: "data", listener: (data: unknown) => void): void };
  stdout?: { on(event: "data", listener: (data: unknown) => void): void };
  once(
    event: "close",
    listener: (code: number | null, signal: string | null) => void,
  ): this;
  once(event: "error", listener: (error: Error) => void): this;
  once(
    event: "exit",
    listener: (code: number | null, signal: string | null) => void,
  ): this;
  once(event: "spawn", listener: () => void): this;
  unref(): void;
}

interface LaunchDeps {
  env?: NodeJS.ProcessEnv;
  spawn(
    command: string,
    args: string[],
    options: {
      detached: true;
      env: NodeJS.ProcessEnv;
      stdio: ["ignore", "pipe", "pipe"];
    },
  ): SpawnedEditorProcess;
}

interface SanitizedLaunchEnvironment {
  env: NodeJS.ProcessEnv;
  removedKeys: string[];
}

export function resolveWorkspaceArg(
  workspace: WorkspaceShape,
): string | undefined {
  if (isLocalFileUri(workspace.workspaceFile)) {
    return workspace.workspaceFile.fsPath;
  }
  const folders = workspace.workspaceFolders ?? [];
  const [folder] = folders;
  return folders.length === 1 && isLocalFileUri(folder?.uri)
    ? folder.uri.fsPath
    : undefined;
}

function isLocalFileUri(uri: WorkspaceUri | undefined): uri is WorkspaceUri {
  if (!uri?.fsPath) {
    return false;
  }
  return uri.scheme === undefined || uri.scheme === "file";
}

export function buildLaunchCommand(input: {
  entry: UserdataEntry;
  storeRoot: string;
  workspacePath?: string;
  editorCli: string;
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
  logger?: LaunchLogger;
}): LaunchCommand {
  const editorCli = input.host.discoverEditorCli(input.appRoot, {
    logger: input.logger,
  });
  if (!editorCli) {
    throw new Error(
      `Could not find ${input.host.displayName} CLI in this installation.`,
    );
  }

  validateManagedUserdataSocketPath(input);

  return buildLaunchCommand({
    entry: input.entry,
    storeRoot: input.storeRoot,
    workspacePath: resolveWorkspaceArg(input.workspace),
    editorCli,
    sharedExtensionsDirectory:
      input.entry.kind === "managed"
        ? input.host.resolveSharedExtensionsDirectory()
        : null,
  });
}

function validateManagedUserdataSocketPath(input: {
  entry: UserdataEntry;
  host: SupportedHostAdapter;
  logger?: LaunchLogger;
  storeRoot: string;
}): void {
  if (
    process.platform !== "darwin" ||
    input.entry.kind !== "managed" ||
    !input.entry.relativeDataDir
  ) {
    return;
  }

  const socketPath = `${resolveManagedDataDir(
    input.storeRoot,
    input.entry.relativeDataDir,
  )}/${VSCODE_MAIN_SOCKET_BASENAME}`;
  input.logger?.info(
    `macOS socket path length=${socketPath.length}/${MACOS_UNIX_SOCKET_PATH_LIMIT}: ${socketPath}`,
  );
  if (socketPath.length > MACOS_UNIX_SOCKET_PATH_LIMIT) {
    throw new Error(
      `Managed userdata path is too long for ${input.host.displayName} on macOS (${socketPath.length}/${MACOS_UNIX_SOCKET_PATH_LIMIT}). Create a userdata with a shorter label or use a shorter home path.`,
    );
  }
}

export async function openWithUserdata(input: {
  entry: UserdataEntry;
  host: SupportedHostAdapter;
  appRoot: string;
  storeRoot: string;
  workspace: WorkspaceShape;
  logger?: LaunchLogger;
  launchEditorImpl?: LaunchEditor;
}): Promise<void> {
  const command = buildOpenWithUserdataCommand(input);
  input.logger?.info(
    `Launching ${input.host.displayName}: ${formatLaunchCommand(command)}`,
  );
  const launch = input.launchEditorImpl ?? launchEditor;
  await launch(command, { logger: input.logger });
}

export function launchEditor(
  command: LaunchCommand,
  options?: LaunchEditorOptions,
): Promise<void>;
export function launchEditor(
  command: LaunchCommand,
  deps: LaunchDeps,
  options?: LaunchEditorOptions,
): Promise<void>;
export function launchEditor(
  command: LaunchCommand,
  depsOrOptions: LaunchDeps | LaunchEditorOptions = {},
  maybeOptions: LaunchEditorOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const hasDeps = "spawn" in depsOrOptions;
    const deps: LaunchDeps = hasDeps ? depsOrOptions : { spawn };
    const options = hasDeps ? maybeOptions : depsOrOptions;
    const logger = options.logger;
    const { env, removedKeys } = sanitizeEditorLaunchEnvironment(
      deps.env ?? process.env,
    );
    logger?.info(
      `Launch environment sanitized; removed ${
        removedKeys.length ? removedKeys.join(", ") : "none"
      }`,
    );

    let child: SpawnedEditorProcess;
    try {
      child = deps.spawn(command.command, command.args, {
        detached: true,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      reject(error);
      return;
    }

    child.stdout?.on("data", (data) => {
      logProcessOutput(logger, "stdout", data);
    });
    child.stderr?.on("data", (data) => {
      logProcessOutput(logger, "stderr", data);
    });
    child.once("exit", (code, signal) => {
      logger?.info(
        `Editor CLI exit event: code=${formatExitValue(code)} signal=${formatExitValue(signal)}`,
      );
    });
    child.once("close", (code, signal) => {
      logger?.info(
        `Editor CLI close event: code=${formatExitValue(code)} signal=${formatExitValue(signal)}`,
      );
    });

    let settled = false;
    child.once("error", (error) => {
      if (!settled) {
        settled = true;
        logger?.error(`Editor CLI spawn error: ${error.message}`);
        reject(error);
      }
    });
    child.once("spawn", () => {
      if (!settled) {
        settled = true;
        child.unref();
        logger?.info("Editor CLI spawned successfully");
        resolve();
      }
    });
  });
}

export function sanitizeEditorLaunchEnvironment(
  source: NodeJS.ProcessEnv,
): SanitizedLaunchEnvironment {
  const env: NodeJS.ProcessEnv = { ...source };
  const removedKeys: string[] = [];

  for (const key of Object.keys(env)) {
    if (shouldRemoveLaunchEnvironmentKey(key)) {
      delete env[key];
      removedKeys.push(key);
    }
  }

  return { env, removedKeys: removedKeys.sort() };
}

function shouldRemoveLaunchEnvironmentKey(key: string): boolean {
  return (
    /^ELECTRON_.+$/.test(key) ||
    /^VSCODE_(?!(PORTABLE|SHELL_LOGIN|ENV_REPLACE|ENV_APPEND|ENV_PREPEND)).+$/.test(
      key,
    )
  );
}

function formatLaunchCommand(command: LaunchCommand): string {
  return [command.command, ...command.args]
    .map((part) => JSON.stringify(part))
    .join(" ");
}

function logProcessOutput(
  logger: LaunchLogger | undefined,
  stream: "stderr" | "stdout",
  data: unknown,
): void {
  const output = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
  for (const line of output.split(/\r?\n/)) {
    if (line.trim()) {
      logger?.info(`Editor CLI ${stream}: ${line}`);
    }
  }
}

function formatExitValue(value: number | string | null): string {
  return value === null ? "null" : String(value);
}
