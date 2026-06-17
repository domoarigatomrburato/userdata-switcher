import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  probeRunningUserdataInstance,
  type RunningInstanceProbeDeps,
} from "./editorIpc";

const HELPER_PROCESS_MARKERS = [
  " Helper",
  "crashpad_handler",
  "chrome_crashpad",
];

export interface QuitUserdataInstanceDeps extends RunningInstanceProbeDeps {
  listProcessLines?: () => string[];
  killProcess?: (pid: number, signal: NodeJS.Signals) => void;
  sleep?: (ms: number) => Promise<void>;
  waitTimeoutMs?: number;
}

export function commandLineUsesUserdataRoot(
  command: string,
  userdataRoot: string,
): boolean {
  const resolvedRoot = path.resolve(userdataRoot);
  return (
    command.includes(resolvedRoot) ||
    command.includes(userdataRoot) ||
    command.includes(`--user-data-dir=${resolvedRoot}`) ||
    command.includes(`--user-data-dir=${userdataRoot}`) ||
    command.includes(`--user-data-dir ${resolvedRoot}`) ||
    command.includes(`--user-data-dir ${userdataRoot}`)
  );
}

export function isMainEditorProcess(command: string): boolean {
  return !HELPER_PROCESS_MARKERS.some((marker) => command.includes(marker));
}

export function listMainProcessIdsForUserdataRoot(
  userdataRoot: string,
  deps: Pick<QuitUserdataInstanceDeps, "listProcessLines"> = {},
): number[] {
  const lines = deps.listProcessLines ?? defaultProcessLines;
  const processIds = new Set<number>();

  for (const line of lines()) {
    if (
      !commandLineUsesUserdataRoot(line, userdataRoot) ||
      !isMainEditorProcess(line)
    ) {
      continue;
    }

    const match = line.trim().match(/^(\d+)\s+/);
    if (match) {
      processIds.add(Number(match[1]));
    }
  }

  return [...processIds];
}

export async function quitUserdataEditorInstance(
  userdataRoot: string,
  deps: QuitUserdataInstanceDeps = {},
): Promise<boolean> {
  const platform = deps.platform ?? process.platform;
  if (platform === "win32") {
    return false;
  }

  const killProcess =
    deps.killProcess ?? ((pid, signal) => process.kill(pid, signal));
  const sleep =
    deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const waitTimeoutMs = deps.waitTimeoutMs ?? 5_000;

  const waitUntilStopped = async (deadlineMs: number): Promise<boolean> => {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      if (
        (await probeRunningUserdataInstance(userdataRoot, deps)) ===
        "not-running"
      ) {
        return true;
      }
      await sleep(200);
    }
    return false;
  };

  const signalMatchingProcesses = (signal: NodeJS.Signals) => {
    for (const pid of listMainProcessIdsForUserdataRoot(userdataRoot, deps)) {
      try {
        killProcess(pid, signal);
      } catch {
        // Another caller may already have stopped the process.
      }
    }
  };

  signalMatchingProcesses("SIGTERM");
  if (await waitUntilStopped(waitTimeoutMs)) {
    return true;
  }

  signalMatchingProcesses("SIGKILL");
  return waitUntilStopped(2_000);
}

function defaultProcessLines(): string[] {
  const result = spawnSync("ps", ["ax", "-o", "pid=", "-o", "command="], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
