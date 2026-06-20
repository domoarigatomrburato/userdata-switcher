import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeleteUserdataConfirmation,
  executeManagedUserdataDeletion,
} from "./deleteManagedUserdata";
import { DELETE_QUIT_AND_DELETE_LABEL } from "./deleteUserdata";

describe("buildDeleteUserdataConfirmation", () => {
  it("offers a simple delete confirmation when no instance is running", () => {
    const confirmation = buildDeleteUserdataConfirmation("Personal", false);

    assert.equal(confirmation.confirmLabel, "Delete");
    assert.match(confirmation.message, /Delete userdata "Personal"/);
    assert.doesNotMatch(confirmation.message, /still running/);
  });

  it("offers quit and delete when an instance is still running", () => {
    const confirmation = buildDeleteUserdataConfirmation("Personal", true);

    assert.equal(confirmation.confirmLabel, DELETE_QUIT_AND_DELETE_LABEL);
    assert.match(confirmation.message, /still running/);
    assert.match(confirmation.message, /Quit and delete/);
  });
});

describe("executeManagedUserdataDeletion", () => {
  it("deletes when the user confirms and no instance is running", async () => {
    let deleted = false;

    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => false,
      quitManagedUserdataInstance: async () => false,
      deletePath: async () => {
        deleted = true;
      },
      pathExists: () => false,
      confirmDeletion: async () => true,
    });

    assert.equal(outcome.status, "success");
    assert.equal(deleted, true);
  });

  it("quits a running instance before deleting when the user confirms quit and delete", async () => {
    let quitCalled = false;
    let running = true;

    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => running,
      quitManagedUserdataInstance: async () => {
        quitCalled = true;
        running = false;
        return true;
      },
      deletePath: async () => {},
      pathExists: () => false,
      confirmDeletion: async () => true,
    });

    assert.equal(outcome.status, "success");
    assert.equal(quitCalled, true);
  });

  it("does not trash files when the instance is running again before delete", async () => {
    let deleted = false;
    let probeCount = 0;

    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => {
        probeCount += 1;
        return probeCount !== 3;
      },
      quitManagedUserdataInstance: async () => true,
      deletePath: async () => {
        deleted = true;
      },
      pathExists: () => false,
      confirmDeletion: async () => true,
    });

    assert.equal(outcome.status, "quit-failed");
    assert.equal(deleted, false);
  });

  it("does not delete when quit fails for a running instance", async () => {
    let deleted = false;

    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => true,
      quitManagedUserdataInstance: async () => false,
      deletePath: async () => {
        deleted = true;
      },
      pathExists: () => false,
      confirmDeletion: async () => true,
    });

    assert.equal(outcome.status, "quit-failed");
    assert.equal(deleted, false);
  });

  it("does not report success when the folder still exists after delete", async () => {
    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => false,
      quitManagedUserdataInstance: async () => false,
      deletePath: async () => {},
      pathExists: () => true,
      confirmDeletion: async () => true,
    });

    assert.deepEqual(outcome, {
      status: "verify-failed",
      reason: "path-still-exists",
    });
  });

  it("does not report success when the instance is still running after delete", async () => {
    let phase: "initial" | "after-quit" | "after-delete" = "initial";

    const outcome = await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      isManagedUserdataInUse: async () => {
        if (phase === "initial") {
          return true;
        }
        if (phase === "after-quit") {
          return false;
        }
        return true;
      },
      quitManagedUserdataInstance: async () => {
        phase = "after-quit";
        return true;
      },
      deletePath: async () => {
        phase = "after-delete";
      },
      pathExists: () => false,
      confirmDeletion: async () => true,
    });

    assert.deepEqual(outcome, {
      status: "verify-failed",
      reason: "instance-still-running",
    });
  });

  it("logs Windows process preflight instead of Unix socket candidates", async () => {
    const logs: string[] = [];

    await executeManagedUserdataDeletion({
      targetPath: "C:\\Users\\ale\\AppData\\Local\\udsw\\cursor\\u\\testone",
      label: "testone",
      platform: "win32",
      isManagedUserdataInUse: async () => false,
      quitManagedUserdataInstance: async () => false,
      deletePath: async () => {},
      pathExists: () => false,
      confirmDeletion: async () => false,
      logInfo: (message) => logs.push(message),
    });

    assert.deepEqual(logs, [
      "Delete preflight: checking for running editor processes (Windows)",
    ]);
  });

  it("logs Unix socket candidates during preflight on macOS and Linux", async () => {
    const logs: string[] = [];

    await executeManagedUserdataDeletion({
      targetPath: "/store/u/personal",
      label: "Personal",
      editorVersion: "1.105.1",
      platform: "linux",
      isManagedUserdataInUse: async () => false,
      quitManagedUserdataInstance: async () => false,
      deletePath: async () => {},
      pathExists: () => false,
      confirmDeletion: async () => false,
      logInfo: (message) => logs.push(message),
    });

    assert.match(logs[0] ?? "", /^Delete preflight socket candidates:/);
  });
});
