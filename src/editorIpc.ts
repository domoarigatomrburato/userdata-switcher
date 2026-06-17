import net from "node:net";
import path from "node:path";

export const VSCODE_MAIN_SOCKET_BASENAME = "1.12-main.sock";

export type RunningInstanceProbeResult = "running" | "not-running";

export interface RunningInstanceProbeDeps {
  platform?: NodeJS.Platform;
  connect?: (
    socketPath: string,
  ) => Promise<"connected" | "missing" | "refused" | "error">;
}

export function mainSocketPath(userdataRoot: string): string {
  return path.join(userdataRoot, VSCODE_MAIN_SOCKET_BASENAME);
}

export async function probeRunningUserdataInstance(
  userdataRoot: string,
  deps: RunningInstanceProbeDeps = {},
): Promise<RunningInstanceProbeResult> {
  const platform = deps.platform ?? process.platform;
  if (platform === "win32") {
    return "not-running";
  }

  const socketPath = mainSocketPath(userdataRoot);
  const result = await (deps.connect ?? defaultConnect)(socketPath);
  return result === "connected" ? "running" : "not-running";
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
