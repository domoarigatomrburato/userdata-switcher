import fs from "node:fs";
import net from "node:net";
import path from "node:path";

/** @deprecated Use {@link mainSocketBasenameForEditorVersion} or socket discovery. */
const VSCODE_MAIN_SOCKET_BASENAME = "1.12-main.sock";

const MAIN_SOCKET_SUFFIX = "-main.sock";

export type RunningInstanceProbeResult = "running" | "not-running";

export interface RunningInstanceProbeDeps {
  platform?: NodeJS.Platform;
  editorVersion?: string;
  readdirSync?: (directory: string) => string[];
  connect?: (
    socketPath: string,
  ) => Promise<"connected" | "missing" | "refused" | "error">;
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

  for (const socketPath of socketPaths) {
    const result = await (deps.connect ?? defaultConnect)(socketPath);
    if (result === "connected") {
      return "running";
    }
  }

  return "not-running";
}

function defaultConnect(
  socketPath: string,
): Promise<"connected" | "missing" | "refused" | "error"> {
  return new Promise((resolve) => {
    const client = net.connect(socketPath);

    const finish = (result: "connected" | "missing" | "refused" | "error") => {
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
