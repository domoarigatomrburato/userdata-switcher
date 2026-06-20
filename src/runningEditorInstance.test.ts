import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commandLineUsesUserdataRoot,
  isMainEditorProcess,
  isUserdataEditorInstanceRunning,
  listMainProcessIdsForUserdataRoot,
  quitUserdataEditorInstance,
} from "./runningEditorInstance";

describe("commandLineUsesUserdataRoot", () => {
  it("matches equals and spaced --user-data-dir forms", () => {
    const userdataRoot =
      "/Users/alice/Library/Application Support/udsw/cursor/u/personal";
    assert.ok(
      commandLineUsesUserdataRoot(
        `/Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=${userdataRoot}`,
        userdataRoot,
      ),
    );
    assert.ok(
      commandLineUsesUserdataRoot(
        `/Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir ${userdataRoot}`,
        userdataRoot,
      ),
    );
  });

  it("does not match a longer userdata root that merely shares a prefix", () => {
    const userdataRoot = "/store/u/work";
    const otherRoot = "/store/u/work-2";
    assert.ok(
      commandLineUsesUserdataRoot(
        `4323 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=${otherRoot}`,
        otherRoot,
      ),
    );
    assert.equal(
      commandLineUsesUserdataRoot(
        `4323 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=${otherRoot}`,
        userdataRoot,
      ),
      false,
    );
  });

  it("matches quoted Windows --user-data-dir values case-insensitively", () => {
    const userdataRoot =
      "C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\ale-win-test-1";
    assert.ok(
      commandLineUsesUserdataRoot(
        `4321 "C:\\Program Files\\Cursor\\Cursor.exe" --user-data-dir="${userdataRoot}"`,
        userdataRoot,
      ),
    );
    assert.ok(
      commandLineUsesUserdataRoot(
        `4321 "C:\\Program Files\\Cursor\\Cursor.exe" --user-data-dir="${userdataRoot.toUpperCase()}"`,
        userdataRoot,
      ),
    );
  });
});

describe("isMainEditorProcess", () => {
  it("ignores helper processes that share the userdata directory", () => {
    assert.equal(
      isMainEditorProcess(
        "1234 /Applications/Cursor.app/Contents/Frameworks/Cursor Helper (GPU)",
      ),
      false,
    );
    assert.equal(
      isMainEditorProcess(
        "1234 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=/tmp/personal",
      ),
      true,
    );
  });
});

describe("listMainProcessIdsForUserdataRoot", () => {
  it("returns only main editor process ids for the target userdata root", () => {
    const userdataRoot = "/store/u/personal";
    assert.deepEqual(
      listMainProcessIdsForUserdataRoot(userdataRoot, {
        listProcessLines: () => [
          `4321 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=${userdataRoot}`,
          `4322 /Applications/Cursor.app/Contents/Frameworks/Cursor Helper (GPU) --user-data-dir=${userdataRoot}`,
          `4323 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=/store/u/work`,
          `4324 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=/store/u/personal-backup`,
        ],
      }),
      [4321],
    );
  });
});

describe("quitUserdataEditorInstance", () => {
  it("terminates matching processes and waits until the IPC socket is gone", async () => {
    const killed: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let probeCount = 0;

    const quit = await quitUserdataEditorInstance("/store/u/personal", {
      platform: "darwin",
      listProcessLines: () => [
        "4321 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=/store/u/personal",
      ],
      killProcess: (pid, signal) => {
        killed.push({ pid, signal });
      },
      connect: async () => {
        probeCount += 1;
        return probeCount < 2 ? "connected" : "refused";
      },
      sleep: async () => {},
      waitTimeoutMs: 1_000,
    });

    assert.equal(quit, true);
    assert.deepEqual(killed, [{ pid: 4321, signal: "SIGTERM" }]);
  });

  it("escalates to SIGKILL when SIGTERM does not stop the instance", async () => {
    const signals: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let probeCount = 0;

    const quit = await quitUserdataEditorInstance("/store/u/personal", {
      platform: "darwin",
      listProcessLines: () => [
        "4321 /Applications/Cursor.app/Contents/MacOS/Cursor --user-data-dir=/store/u/personal",
      ],
      killProcess: (pid, signal) => {
        signals.push({ pid, signal });
      },
      connect: async () => {
        probeCount += 1;
        return probeCount < 2 ? "connected" : "refused";
      },
      sleep: async () => {},
      waitTimeoutMs: 0,
    });

    assert.equal(quit, true);
    assert.deepEqual(signals, [
      { pid: 4321, signal: "SIGTERM" },
      { pid: 4321, signal: "SIGKILL" },
    ]);
  });
});

describe("isUserdataEditorInstanceRunning", () => {
  it("detects a running Windows editor process by command line", async () => {
    const userdataRoot =
      "C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\ale-win-test-1";
    const running = await isUserdataEditorInstanceRunning(userdataRoot, {
      platform: "win32",
      listProcessLines: () => [
        `4321 "C:\\Program Files\\Cursor\\Cursor.exe" --user-data-dir="${userdataRoot}"`,
      ],
    });

    assert.equal(running, true);
  });

  it("reports not running on Windows when no process matches the userdata root", async () => {
    const running = await isUserdataEditorInstanceRunning(
      "C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\ale-win-test-1",
      {
        platform: "win32",
        listProcessLines: () => [
          '4321 "C:\\Program Files\\Cursor\\Cursor.exe" --user-data-dir="C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\other"',
        ],
      },
    );

    assert.equal(running, false);
  });
});

describe("quitUserdataEditorInstance on Windows", () => {
  it("terminates matching processes via taskkill and waits until they are gone", async () => {
    const userdataRoot =
      "C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\ale-win-test-1";
    const killed: Array<{ pid: number; signal: NodeJS.Signals }> = [];
    let running = true;

    const quit = await quitUserdataEditorInstance(userdataRoot, {
      platform: "win32",
      listProcessLines: () =>
        running
          ? [
              `4321 "C:\\Program Files\\Cursor\\Cursor.exe" --user-data-dir="${userdataRoot}"`,
            ]
          : [],
      killProcess: (pid, signal) => {
        killed.push({ pid, signal });
        if (signal === "SIGTERM") {
          running = false;
        }
      },
      sleep: async () => {},
      waitTimeoutMs: 1_000,
    });

    assert.equal(quit, true);
    assert.deepEqual(killed, [{ pid: 4321, signal: "SIGTERM" }]);
  });
});
