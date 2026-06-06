#!/usr/bin/env node
/**
 * Runtime validation for Cursor Userdata launcher assumptions.
 *
 * Safe by default: uses temp userdata dirs under the OS temp directory and
 * never runs --reuse-window against the default Cursor userdata.
 */
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_PREFIXES = [
  "cursor-uds-verify-",
  "cursor-uds-reuse-",
  "cursor-uds-verify-launch-",
];
const KEEP = process.argv.includes("--keep");

function usage() {
  console.log(`Usage: npm run research:userdata-launcher -- <command> [--keep]

Commands:
  all            Run all checks (may open brief test Cursor windows)
  cli            Bundled CLI discovery and supported flags
  extensions     Compare --list-extensions for default vs custom userdata
  launch         Launch a custom userdata window and verify isolation
  reuse-window   Test --reuse-window with isolated temp userdatas only
  detect         Verify globalStorage path -> userdata root derivation
  cleanup        Quit test Cursor instances and remove temp dirs

Options:
  --keep         Leave test windows and temp dirs after a run

Examples:
  npm run research:userdata-launcher -- all
  npm run research:userdata-launcher -- reuse-window
  npm run research:userdata-launcher -- cleanup
`);
}

function platformPaths() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return {
      appRoot: "/Applications/Cursor.app/Contents/Resources/app",
      cursorBin: "/Applications/Cursor.app/Contents/MacOS/Cursor",
      bundledCli: "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
      cliJs: "/Applications/Cursor.app/Contents/Resources/app/out/cli.js",
      defaultUserdata: path.join(home, "Library", "Application Support", "Cursor"),
      extensionsDir: path.join(home, ".cursor", "extensions"),
    };
  }
  if (process.platform === "linux") {
    return {
      appRoot: null,
      cursorBin: null,
      bundledCli: null,
      cliJs: null,
      defaultUserdata: path.join(
        process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"),
        "Cursor",
      ),
      extensionsDir: path.join(home, ".cursor", "extensions"),
    };
  }
  if (process.platform === "win32") {
    const local = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    return {
      appRoot: null,
      cursorBin: null,
      bundledCli: null,
      cliJs: null,
      defaultUserdata: path.join(local, "Cursor"),
      extensionsDir: path.join(home, ".cursor", "extensions"),
    };
  }
  throw new Error(`Unsupported platform: ${process.platform}`);
}

function run(cmd, args, options = {}) {
  return execFileSync(cmd, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function runCli(paths, args) {
  if (paths.bundledCli && fs.existsSync(paths.bundledCli)) {
    return run(paths.bundledCli, args);
  }
  if (paths.cliJs && paths.cursorBin && fs.existsSync(paths.cliJs)) {
    return run(paths.cursorBin, [
      paths.cliJs,
      ...args,
    ], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
    });
  }
  throw new Error("No usable Cursor CLI found for this platform");
}

function tempDir(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${TEST_PREFIXES[0]}${label}-`));
}

function isTestUserdata(userdataDir) {
  if (!userdataDir) {
    return false;
  }
  const base = path.basename(userdataDir);
  return TEST_PREFIXES.some((prefix) => base.startsWith(prefix));
}

function tempSearchRoots() {
  return [...new Set([os.tmpdir(), "/tmp", "/private/tmp"])];
}

function listMainProcesses(userdataDir = null) {
  const ps = run("ps", ["aux"]);
  return ps
    .split("\n")
    .filter((line) => line.includes("Cursor.app/Contents/MacOS/Cursor"))
    .filter((line) => !line.includes("rg"))
    .filter((line) => {
      if (!userdataDir) {
        return true;
      }
      return line.includes(`--user-data-dir ${userdataDir}`) ||
        line.includes(`--user-data-dir=${userdataDir}`);
    });
}

function countMainProcesses(userdataDir) {
  return listMainProcesses(userdataDir).length;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitFor(predicate, { timeoutMs = 30_000, intervalMs = 500, label = "condition" } = {}) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        const value = predicate();
        if (value) {
          resolve(value);
          return;
        }
      } catch (error) {
        reject(error);
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error(`Timed out waiting for ${label}`));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function launchCursor(paths, args) {
  const launcher = paths.bundledCli && fs.existsSync(paths.bundledCli)
    ? paths.bundledCli
    : paths.cursorBin;
  if (!launcher || !fs.existsSync(launcher)) {
    throw new Error("Cursor launcher binary not found");
  }
  const child = spawn(launcher, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function deriveUserdataRootFromGlobalStorage(globalStorageUri) {
  const marker = `${path.sep}User${path.sep}globalStorage${path.sep}`;
  const index = globalStorageUri.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return globalStorageUri.slice(0, index);
}

function pass(message) {
  console.log(`PASS  ${message}`);
}

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

function note(message) {
  console.log(`NOTE  ${message}`);
}

function checkCli(paths) {
  console.log("\n== CLI discovery ==");
  if (!paths.bundledCli || !fs.existsSync(paths.bundledCli)) {
    fail(`bundled CLI missing: ${paths.bundledCli ?? "(unknown)"}`);
    return;
  }
  pass(`bundled CLI: ${paths.bundledCli}`);

  if (paths.cliJs && fs.existsSync(paths.cliJs)) {
    pass(`cli.js: ${paths.cliJs}`);
  } else {
    fail(`cli.js missing: ${paths.cliJs ?? "(unknown)"}`);
  }

  const help = runCli(paths, ["--help"]);
  for (const flag of [
    "--user-data-dir",
    "--extensions-dir",
    "--new-window",
    "--reuse-window",
  ]) {
    if (help.includes(flag)) {
      pass(`flag supported: ${flag}`);
    } else {
      fail(`flag missing from help: ${flag}`);
    }
  }

  const version = runCli(paths, ["--version"]).trim().split("\n")[0];
  pass(`cursor version: ${version}`);
}

function checkExtensions(paths) {
  console.log("\n== Extension sharing (CLI list) ==");
  const customUserdata = tempDir("extensions");
  try {
    const defaultList = runCli(paths, ["--list-extensions"])
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();
    const customList = runCli(paths, ["--user-data-dir", customUserdata, "--list-extensions"])
      .trim()
      .split("\n")
      .filter(Boolean)
      .sort();

    if (defaultList.join("\n") === customList.join("\n")) {
      pass(`extension lists match (${defaultList.length} extensions)`);
    } else {
      fail("extension lists differ between default and custom userdata");
      note(`default: ${defaultList.join(", ")}`);
      note(`custom: ${customList.join(", ")}`);
    }

    if (paths.extensionsDir && fs.existsSync(paths.extensionsDir)) {
      pass(`shared extensions dir exists: ${paths.extensionsDir}`);
    } else {
      note(`shared extensions dir not found: ${paths.extensionsDir}`);
    }
  } finally {
    if (!KEEP) {
      fs.rmSync(customUserdata, { recursive: true, force: true });
    } else {
      note(`kept custom userdata: ${customUserdata}`);
    }
  }
}

async function checkLaunch(paths) {
  console.log("\n== Launch + isolation ==");
  const userdata = tempDir("launch");
  const workspace = tempDir("workspace");
  fs.writeFileSync(path.join(workspace, "README.md"), "userdata launcher verify\n");

  try {
    launchCursor(paths, ["--user-data-dir", userdata, "--new-window", workspace]);
    await waitFor(
      () => fs.existsSync(path.join(userdata, "User", "globalStorage", "state.vscdb")),
      { label: "custom userdata state.vscdb" },
    );
    pass("custom userdata bootstrapped with isolated state.vscdb");

    const defaultDb = path.join(paths.defaultUserdata, "User", "globalStorage", "state.vscdb");
    const customDb = path.join(userdata, "User", "globalStorage", "state.vscdb");
    if (fs.existsSync(defaultDb) && fs.existsSync(customDb)) {
      const sameFile = fs.realpathSync(defaultDb) === fs.realpathSync(customDb);
      if (!sameFile) {
        pass("custom userdata uses a separate state.vscdb from default");
      } else {
        fail("custom userdata state.vscdb resolves to the default database");
      }
    }

    const exthostLog = findFile(userdata, "exthost.log");
    if (exthostLog) {
      const log = fs.readFileSync(exthostLog, "utf8");
      const activated = [...log.matchAll(/_doActivateExtension ([^,\s]+)/g)].map((m) => m[1]);
      const userExtensions = activated.filter((id) => !id.startsWith("vscode.") && !id.startsWith("anysphere.") && !id.startsWith("cursor."));
      if (userExtensions.length > 0) {
        pass(`user extensions activated in new userdata: ${userExtensions.join(", ")}`);
      } else {
        note("no third-party user extensions activated in exthost log (may be expected on a minimal install)");
      }
    } else {
      note("exthost.log not found yet; activation check skipped");
    }

    pass(`opened test window: userdata=${userdata} workspace=${workspace}`);
  } finally {
    if (!KEEP) {
      await cleanupTestArtifacts();
    } else {
      note(`kept launch userdata: ${userdata}`);
      note(`kept launch workspace: ${workspace}`);
    }
  }
}

async function checkReuseWindow(paths) {
  console.log("\n== --reuse-window (isolated temp userdatas only) ==");
  const userdata = tempDir("reuse");
  const workspace = tempDir("workspace");
  const workspace2 = tempDir("workspace2");
  fs.writeFileSync(path.join(workspace, "README.md"), "reuse a\n");
  fs.writeFileSync(path.join(workspace2, "README.md"), "reuse b\n");

  try {
    launchCursor(paths, ["--user-data-dir", userdata, "--new-window", workspace]);
    await waitFor(() => countMainProcesses(userdata) >= 1, { label: "first launch main process" });
    const baseline = countMainProcesses(userdata);
    pass(`baseline main processes for test userdata: ${baseline}`);

    launchCursor(paths, ["--user-data-dir", userdata, "--reuse-window", workspace]);
    await sleep(4000);
    const afterSame = countMainProcesses(userdata);
    if (afterSame <= baseline) {
      pass("same userdata + same workspace + --reuse-window did not create a new main process");
    } else {
      fail(`reuse-window duplicated main process (${baseline} -> ${afterSame})`);
    }

    launchCursor(paths, ["--user-data-dir", userdata, "--reuse-window", workspace2]);
    await sleep(4000);
    const afterOtherFolder = countMainProcesses(userdata);
    if (afterOtherFolder <= baseline) {
      pass("same userdata + different folder + --reuse-window did not create a new main process");
    } else {
      fail(`reuse-window with different folder duplicated main process (${baseline} -> ${afterOtherFolder})`);
    }

    const userdataB = tempDir("reuse-b");
    launchCursor(paths, ["--user-data-dir", userdataB, "--reuse-window", workspace]);
    await sleep(5000);
    const defaultBefore = countMainProcesses(paths.defaultUserdata);
    const userdataBCount = countMainProcesses(userdataB);
    if (userdataBCount >= 1) {
      pass("different userdata + --reuse-window launched a separate instance");
    } else {
      fail("different userdata + --reuse-window did not launch");
    }
    const defaultAfter = countMainProcesses(paths.defaultUserdata);
    if (defaultAfter === defaultBefore) {
      pass("different userdata + --reuse-window did not change default userdata main process count");
    } else {
      fail(`default userdata main process count changed (${defaultBefore} -> ${defaultAfter})`);
    }

    launchCursor(paths, ["--user-data-dir", userdata, "--new-window", workspace]);
    await sleep(5000);
    const windowDirs = listWindowLogDirs(userdata);
    if (windowDirs.length >= 2) {
      pass(`second --new-window created another window log (${windowDirs.length} windows)`);
    } else {
      note(`expected a second window log after --new-window; found ${windowDirs.length}`);
    }

    note("did not test --reuse-window on default userdata (would risk hijacking the active window)");
  } finally {
    if (!KEEP) {
      await cleanupTestArtifacts();
    } else {
      note(`kept reuse userdata dirs under ${os.tmpdir()}`);
    }
  }
}

function checkDetect(paths) {
  console.log("\n== Current userdata detection ==");
  const customUserdata = tempDir("detect");
  const simulatedCustom = path.join(
    customUserdata,
    "User",
    "globalStorage",
    "publisher.cursor-userdata-switcher",
    "globalStorage",
  );
  const simulatedDefault = path.join(
    paths.defaultUserdata,
    "User",
    "globalStorage",
    "publisher.cursor-userdata-switcher",
    "globalStorage",
  );

  const derivedCustom = deriveUserdataRootFromGlobalStorage(simulatedCustom);
  const derivedDefault = deriveUserdataRootFromGlobalStorage(simulatedDefault);

  if (derivedCustom === customUserdata) {
    pass("custom globalStorageUri derives back to managed userdata root");
  } else {
    fail(`custom derivation failed: ${derivedCustom}`);
  }

  if (derivedDefault === paths.defaultUserdata) {
    pass("default globalStorageUri derives back to default userdata root");
  } else {
    fail(`default derivation failed: ${derivedDefault}`);
  }

  if (!KEEP) {
    fs.rmSync(customUserdata, { recursive: true, force: true });
  }
}

function findFile(root, name) {
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.name === name) {
        return fullPath;
      }
    }
  }
  return null;
}

function listWindowLogDirs(userdataDir) {
  const logsDir = path.join(userdataDir, "logs");
  if (!fs.existsSync(logsDir)) {
    return [];
  }
  const windows = new Set();
  for (const session of fs.readdirSync(logsDir)) {
    const sessionDir = path.join(logsDir, session);
    if (!fs.statSync(sessionDir).isDirectory()) {
      continue;
    }
    for (const entry of fs.readdirSync(sessionDir)) {
      if (entry.startsWith("window")) {
        windows.add(path.join(sessionDir, entry));
      }
    }
  }
  return [...windows];
}

async function cleanupTestArtifacts() {
  console.log("\n== Cleanup ==");
  const processes = listMainProcesses()
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length > 10)
    .map((parts) => {
      const commandStart = parts.slice(10).join(" ");
      const match = commandStart.match(/--user-data-dir[ =](\S+)/);
      return {
        pid: Number(parts[1]),
        userdata: match?.[1] ?? null,
        command: commandStart,
      };
    })
    .filter((entry) => entry.userdata && (isTestUserdata(entry.userdata) || path.basename(entry.userdata).startsWith("cursor-uds-")));

  for (const entry of processes) {
    try {
      process.kill(entry.pid, "SIGTERM");
      pass(`sent SIGTERM to pid ${entry.pid} (${entry.userdata})`);
    } catch (error) {
      note(`could not terminate pid ${entry.pid}: ${error.message}`);
    }
  }

  if (processes.length > 0) {
    await sleep(2000);
  }

  for (const root of tempSearchRoots()) {
    if (!fs.existsSync(root)) {
      continue;
    }
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith("cursor-uds-")) {
        continue;
      }
      const fullPath = path.join(root, entry);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
        pass(`removed ${fullPath}`);
      } catch (error) {
        note(`could not remove ${fullPath}: ${error.message}`);
      }
    }
  }
}

async function main() {
  const command = process.argv.find((arg) => !arg.startsWith("-") && arg !== process.argv[0] && arg !== process.argv[1]);
  if (!command || command === "help" || command === "--help") {
    usage();
    return;
  }

  const paths = platformPaths();

  switch (command) {
    case "cli":
      checkCli(paths);
      break;
    case "extensions":
      checkExtensions(paths);
      break;
    case "launch":
      await checkLaunch(paths);
      break;
    case "reuse-window":
      await checkReuseWindow(paths);
      break;
    case "detect":
      checkDetect(paths);
      break;
    case "cleanup":
      await cleanupTestArtifacts();
      break;
    case "all":
      checkCli(paths);
      checkExtensions(paths);
      checkDetect(paths);
      await checkLaunch(paths);
      await checkReuseWindow(paths);
      break;
    default:
      usage();
      process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
