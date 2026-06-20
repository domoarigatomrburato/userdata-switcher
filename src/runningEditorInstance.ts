import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  probeRunningUserdataInstance,
  type RunningInstanceProbeDeps,
} from "./editorIpc";
import { pathApiForPath } from "./paths";

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
  for (const candidate of parseUserDataDirArgs(command)) {
    if (userdataRootsEqual(candidate, userdataRoot)) {
      return true;
    }
  }
  return false;
}

function userdataRootsEqual(left: string, right: string): boolean {
  const pathApi =
    pathApiForPath(left) === path.win32 ? path.win32 : pathApiForPath(right);
  const normalizedLeft = pathApi.resolve(left);
  const normalizedRight = pathApi.resolve(right);
  return pathApi === path.win32
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function parseUserDataDirArgs(command: string): string[] {
  const flag = "--user-data-dir";
  const values: string[] = [];
  let searchFrom = 0;

  while (searchFrom < command.length) {
    const flagIndex = command.indexOf(flag, searchFrom);
    if (flagIndex === -1) {
      break;
    }

    const afterFlag = command.slice(flagIndex + flag.length);
    let rawValue: string | undefined;
    if (afterFlag.startsWith("=")) {
      rawValue = afterFlag.slice(1);
    } else if (/^\s/.test(afterFlag)) {
      rawValue = afterFlag.trimStart();
    }

    if (rawValue !== undefined) {
      const nextFlag = rawValue.indexOf(" --");
      values.push(
        normalizeArgValue(
          nextFlag === -1 ? rawValue : rawValue.slice(0, nextFlag),
        ),
      );
    }

    searchFrom = flagIndex + flag.length;
  }

  return values;
}

function normalizeArgValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function isMainEditorProcess(command: string): boolean {
  return !HELPER_PROCESS_MARKERS.some((marker) => command.includes(marker));
}

export function listMainProcessIdsForUserdataRoot(
  userdataRoot: string,
  deps: Pick<QuitUserdataInstanceDeps, "listProcessLines" | "platform"> = {},
): number[] {
  const platform = deps.platform ?? process.platform;
  const lines = deps.listProcessLines ?? createDefaultProcessLines(platform);
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

export async function isUserdataEditorInstanceRunning(
  userdataRoot: string,
  deps: QuitUserdataInstanceDeps = {},
): Promise<boolean> {
  const platform = deps.platform ?? process.platform;
  if (platform === "win32") {
    return listMainProcessIdsForUserdataRoot(userdataRoot, deps).length > 0;
  }

  return (await probeRunningUserdataInstance(userdataRoot, deps)) === "running";
}

export async function quitUserdataEditorInstance(
  userdataRoot: string,
  deps: QuitUserdataInstanceDeps = {},
): Promise<boolean> {
  const platform = deps.platform ?? process.platform;
  const killProcess = deps.killProcess ?? createDefaultKillProcess(platform);
  const sleep =
    deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const waitTimeoutMs = deps.waitTimeoutMs ?? 5_000;

  const waitUntilStopped = async (deadlineMs: number): Promise<boolean> => {
    const deadline = Date.now() + deadlineMs;
    while (Date.now() < deadline) {
      if (!(await isUserdataEditorInstanceRunning(userdataRoot, deps))) {
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

function createDefaultProcessLines(platform: NodeJS.Platform): () => string[] {
  return platform === "win32"
    ? defaultWindowsProcessLines
    : defaultUnixProcessLines;
}

function createDefaultKillProcess(
  platform: NodeJS.Platform,
): (pid: number, signal: NodeJS.Signals) => void {
  if (platform === "win32") {
    return (pid, signal) => {
      const args =
        signal === "SIGKILL"
          ? ["/F", "/PID", String(pid)]
          : ["/PID", String(pid)];
      spawnSync("taskkill", args, { stdio: "ignore" });
    };
  }

  return (pid, signal) => {
    process.kill(pid, signal);
  };
}

function defaultUnixProcessLines(): string[] {
  const result = spawnSync("ps", ["ax", "-o", "pid=", "-o", "command="], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}

function defaultWindowsProcessLines(): string[] {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      'Get-CimInstance Win32_Process | Where-Object { $_.CommandLine } | ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }',
    ],
    { encoding: "utf8", timeout: 10_000 },
  );
  if (result.status !== 0) {
    return [];
  }
  return result.stdout.split(/\r?\n/).filter(Boolean);
}
