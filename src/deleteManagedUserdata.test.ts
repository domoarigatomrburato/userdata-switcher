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
});
