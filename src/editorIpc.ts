import fs from "node:fs";
import net from "node:net";
import path from "node:path";

/** @deprecated Use {@link mainSocketBasenameForEditorVersion} or socket discovery. */
const VSCODE_MAIN_SOCKET_BASENAME = "1.12-main.sock";

const MAIN_SOCKET_SUFFIX = "-main.sock";
const DEFAULT_IPC_CONNECT_TIMEOUT_MS = 2_000;

export type RunningInstanceProbeResult = "running" | "not-running";

type ConnectResult = "connected" | "missing" | "refused" | "error";

export interface RunningInstanceProbeDeps {
  platform?: NodeJS.Platform;
  editorVersion?: string;
  connectTimeoutMs?: number;
  readdirSync?: (directory: string) => string[];
  connect?: (socketPath: string) => Promise<ConnectResult>;
}

export function mainSocketBasenameForEditorVersion(version: string): string {
  const versionForSocket = version.slice(0, 4);
  const typeForSocket = "main".slice(0, 6);
  return `${versionForSocket}-${typeForSocket}.sock`;
}

export function listMainSocketPaths(
  userdataRoot: string,
  editorVersion?: string,
  readdirSync: (directory: string) => string[] = fs.readdirSync,
): string[] {
  const candidates = new Set<string>();
  if (editorVersion) {
    candidates.add(
      path.join(
        userdataRoot,
        mainSocketBasenameForEditorVersion(editorVersion),
      ),
    );
  }

  try {
    for (const entry of readdirSync(userdataRoot)) {
      if (entry.endsWith(MAIN_SOCKET_SUFFIX)) {
        candidates.add(path.join(userdataRoot, entry));
      }
    }
  } catch {
    return [...candidates];
  }

  return [...candidates];
}

export function mainSocketPath(
  userdataRoot: string,
  editorVersion?: string,
): string {
  return path.join(
    userdataRoot,
    editorVersion
      ? mainSocketBasenameForEditorVersion(editorVersion)
      : VSCODE_MAIN_SOCKET_BASENAME,
  );
}

export async function probeRunningUserdataInstance(
  userdataRoot: string,
  deps: RunningInstanceProbeDeps = {},
): Promise<RunningInstanceProbeResult> {
  const platform = deps.platform ?? process.platform;
  if (platform === "win32") {
    return "not-running";
  }

  const socketPaths = listMainSocketPaths(
    userdataRoot,
    deps.editorVersion,
    deps.readdirSync,
  );

  const connect =
    deps.connect ?? ((socketPath: string) => defaultConnect(socketPath));
  const timeoutMs = deps.connectTimeoutMs ?? DEFAULT_IPC_CONNECT_TIMEOUT_MS;

  for (const socketPath of socketPaths) {
    const result = await connectWithTimeout(socketPath, connect, timeoutMs);
    if (result === "connected") {
      return "running";
    }
  }

  return "not-running";
}

async function connectWithTimeout(
  socketPath: string,
  connect: (socketPath: string) => Promise<ConnectResult>,
  timeoutMs: number,
): Promise<ConnectResult> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      connect(socketPath),
      new Promise<ConnectResult>((resolve) => {
        timer = setTimeout(() => resolve("error"), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

function defaultConnect(socketPath: string): Promise<ConnectResult> {
  return new Promise((resolve) => {
    const client = net.connect(socketPath);

    const finish = (result: ConnectResult) => {
      client.removeAllListeners();
      client.destroy();
      resolve(result);
    };

    client.once("connect", () => finish("connected"));
    client.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        finish("missing");
        return;
      }
      if (error.code === "ECONNREFUSED") {
        finish("refused");
        return;
      }
      finish("error");
    });
  });
}
