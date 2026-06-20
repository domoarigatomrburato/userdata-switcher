import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE,
  DELETE_NO_MANAGED_MESSAGE,
  describeDeleteUserdataBlockedReason,
  listDeletableManagedUserdatas,
} from "../src/deleteUserdata";
import {
  defaultAndPersonalRegistry,
  defaultOnlyRegistry,
  workAndPersonalRegistry,
} from "./registryFixtures";

const defaultOnly = defaultOnlyRegistry();
const workAndPersonal = workAndPersonalRegistry();

describe("listDeletableManagedUserdatas", () => {
  it("excludes the current managed userdata", () => {
    const deletable = listDeletableManagedUserdatas(workAndPersonal, {
      kind: "known",
      entry: {
        id: "work",
        kind: "managed",
        label: "Work",
        relativeDataDir: "u/work",
      },
    });

    assert.deepEqual(
      deletable.map((entry) => entry.id),
      ["personal"],
    );
  });

  it("never includes the default userdata", () => {
    const deletable = listDeletableManagedUserdatas(workAndPersonal, {
      kind: "known",
      entry: {
        id: "default",
        kind: "default",
        label: "Default",
      },
    });

    assert.deepEqual(
      deletable.map((entry) => entry.id),
      ["work", "personal"],
    );
  });
});

describe("describeDeleteUserdataBlockedReason", () => {
  it("explains when the current window is the only managed userdata", () => {
    const registry = defaultAndPersonalRegistry();

    assert.equal(
      describeDeleteUserdataBlockedReason(registry, {
        kind: "known",
        entry: {
          id: "personal",
          kind: "managed",
          label: "Personal",
          relativeDataDir: "u/personal",
        },
      }),
      DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE,
    );
  });

  it("reports when there are no managed userdatas to delete", () => {
    assert.equal(
      describeDeleteUserdataBlockedReason(defaultOnly, {
        kind: "known",
        entry: {
          id: "default",
          kind: "default",
          label: "Default",
        },
      }),
      DELETE_NO_MANAGED_MESSAGE,
    );
  });
});
