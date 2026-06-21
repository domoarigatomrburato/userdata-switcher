import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCurrentWindowHeaderLabel } from "../src/labels";
import {
  buildManageUserdataActionMenuItems,
  buildManageUserdatasMenuItems,
  buildOpenInNewWindowMenuItems,
  CREATE_USERDATA_LABEL,
  DELETE_USERDATA_LABEL,
  MANAGE_USERDATAS_LABEL,
  RENAME_USERDATA_LABEL,
  REVEAL_USERDATA_LABEL,
  resolveUserdataMenuIntent,
  type UserdataMenuItem,
} from "../src/menu";
import {
  defaultAndPersonalRegistry,
  defaultOnlyRegistry,
} from "./registryFixtures";

describe("buildOpenInNewWindowMenuItems", () => {
  const registry = defaultAndPersonalRegistry();

  it("pins the current window as a header and lists other userdatas with running state", () => {
    const [defaultUserdata, personalUserdata] = registry.userdatas;
    assert.ok(defaultUserdata);
    assert.ok(personalUserdata);

    const items = buildOpenInNewWindowMenuItems(
      registry,
      { kind: "known", entry: defaultUserdata },
      new Map([
        [defaultUserdata.id, "running"],
        [personalUserdata.id, "idle"],
      ]),
    );

    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["separator", "item", "separator", "item", "item"],
    );
    assert.equal(
      items[0]?.label,
      formatCurrentWindowHeaderLabel({
        kind: "known",
        entry: defaultUserdata,
      }),
    );
    assert.equal(items[1]?.label, "Personal");
    assert.equal(items[1]?.description, "idle");
    assert.deepEqual(items[1]?.intent, {
      kind: "open",
      userdataId: "personal",
    });
    assert.equal(items[3]?.label, CREATE_USERDATA_LABEL);
    assert.deepEqual(items[3]?.intent, { kind: "create" });
    assert.equal(items[4]?.label, MANAGE_USERDATAS_LABEL);
    assert.deepEqual(items[4]?.intent, { kind: "manage" });
  });

  it("lists create and manage when there are no other launch targets", () => {
    const onlyDefault = defaultOnlyRegistry();
    const [current] = onlyDefault.userdatas;
    assert.ok(current);

    const items = buildOpenInNewWindowMenuItems(
      onlyDefault,
      { kind: "known", entry: current },
      new Map([[current.id, "running"]]),
    );

    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["separator", "separator", "item", "item"],
    );
    assert.equal(items[2]?.label, CREATE_USERDATA_LABEL);
    assert.equal(items[3]?.label, MANAGE_USERDATAS_LABEL);
  });

  it("lists all registry userdatas as launch targets when the current window is unmanaged", () => {
    const items = buildOpenInNewWindowMenuItems(
      registry,
      { kind: "unmanaged" },
      new Map([
        ["default", "running"],
        ["personal", "idle"],
      ]),
    );

    assert.deepEqual(
      items
        .filter((item) => item.intent?.kind === "open")
        .map((item) => item.label),
      ["Default (default)", "Personal"],
    );
    assert.ok(items.every((item) => item.intent?.kind !== "rename"));
    assert.ok(items.every((item) => item.intent?.kind !== "reveal"));
    assert.ok(items.every((item) => item.intent?.kind !== "delete"));
  });

  it("marks action CTAs with structured action data instead of relying on labels", () => {
    const current = registry.userdatas[0];
    assert.ok(current);

    const items = buildOpenInNewWindowMenuItems(
      {
        version: 1,
        userdatas: [
          current,
          {
            id: "literal-create-label",
            kind: "managed",
            label: CREATE_USERDATA_LABEL,
            relativeDataDir: "u/literal-create-label",
          },
        ],
      },
      { kind: "known", entry: current },
      new Map([
        [current.id, "running"],
        ["literal-create-label", "idle"],
      ]),
    );

    const managedItem = items.find(
      (item) =>
        item.intent?.kind === "open" && item.label === CREATE_USERDATA_LABEL,
    );
    const createItem = items.find((item) => item.intent?.kind === "create");
    const manageItem = items.find((item) => item.intent?.kind === "manage");

    assert.deepEqual(managedItem?.intent, {
      kind: "open",
      userdataId: "literal-create-label",
    });
    assert.equal(createItem?.label, CREATE_USERDATA_LABEL);
    assert.equal(manageItem?.label, MANAGE_USERDATAS_LABEL);
  });
});

describe("buildManageUserdatasMenuItems", () => {
  const registry = defaultAndPersonalRegistry();

  it("lists every userdata", () => {
    const items = buildManageUserdatasMenuItems(registry);

    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item"],
    );
    assert.deepEqual(items[0]?.intent, {
      kind: "managePick",
      userdataId: "default",
    });
    assert.deepEqual(items[1]?.intent, {
      kind: "managePick",
      userdataId: "personal",
    });
  });
});

describe("buildManageUserdataActionMenuItems", () => {
  const personalEntry = {
    id: "personal",
    kind: "managed" as const,
    label: "Personal",
    relativeDataDir: "u/personal",
  };
  const defaultEntry = {
    id: "default",
    kind: "default" as const,
    label: "Default",
  };

  it("offers rename and reveal for the selected userdata", () => {
    const items = buildManageUserdataActionMenuItems(personalEntry, {
      kind: "known",
      entry: defaultEntry,
    });

    assert.deepEqual(items, [
      {
        label: REVEAL_USERDATA_LABEL,
        intent: { kind: "reveal", userdataId: "personal" },
        alwaysShow: true,
      },
      {
        label: RENAME_USERDATA_LABEL,
        intent: { kind: "rename", userdataId: "personal" },
        alwaysShow: true,
      },
      { kind: "separator", label: "" },
      {
        label: DELETE_USERDATA_LABEL,
        intent: { kind: "delete", userdataId: "personal" },
        alwaysShow: true,
      },
    ]);
  });

  it("omits delete for the current window managed userdata", () => {
    const items = buildManageUserdataActionMenuItems(personalEntry, {
      kind: "known",
      entry: personalEntry,
    });

    assert.ok(items.every((item) => item.intent?.kind !== "delete"));
  });

  it("omits delete for the default userdata", () => {
    const items = buildManageUserdataActionMenuItems(defaultEntry, {
      kind: "known",
      entry: defaultEntry,
    });

    assert.ok(items.every((item) => item.intent?.kind !== "delete"));
  });
});

describe("resolveUserdataMenuIntent", () => {
  const registry = defaultAndPersonalRegistry({
    personal: CREATE_USERDATA_LABEL,
  });

  it("resolves a selected userdata item to an open intent", () => {
    const [current] = registry.userdatas;
    assert.ok(current);
    const items = buildOpenInNewWindowMenuItems(
      registry,
      { kind: "known", entry: current },
      new Map([
        [current.id, "running"],
        [registry.userdatas[1]?.id ?? "", "idle"],
      ]),
    );
    const launchItem = items.find((item) => item.intent?.kind === "open");
    assert.ok(launchItem);

    assert.deepEqual(resolveUserdataMenuIntent(registry, launchItem), {
      kind: "open",
      entry: registry.userdatas[1],
    });
  });

  it("resolves structured action items without matching labels", () => {
    const items = buildOpenInNewWindowMenuItems(
      registry,
      { kind: "unmanaged" },
      new Map([
        ["default", "running"],
        ["personal", "idle"],
      ]),
    );

    assert.deepEqual(resolveUserdataMenuIntent(registry, items[1]), {
      kind: "open",
      entry: registry.userdatas[0],
    });
    assert.deepEqual(
      resolveUserdataMenuIntent(
        registry,
        items.find((item) => item.intent?.kind === "manage"),
      ),
      { kind: "manage" },
    );
    assert.deepEqual(
      resolveUserdataMenuIntent(
        registry,
        items.find((item) => item.intent?.kind === "create"),
      ),
      { kind: "create" },
    );
  });

  it("resolves rename, reveal, and delete intents for a specific userdata", () => {
    assert.deepEqual(
      resolveUserdataMenuIntent(registry, {
        intent: { kind: "rename", userdataId: "personal" },
        label: RENAME_USERDATA_LABEL,
      } as UserdataMenuItem),
      { kind: "rename", entry: registry.userdatas[1] },
    );
    assert.deepEqual(
      resolveUserdataMenuIntent(registry, {
        intent: { kind: "reveal", userdataId: "personal" },
        label: REVEAL_USERDATA_LABEL,
      } as UserdataMenuItem),
      { kind: "reveal", entry: registry.userdatas[1] },
    );
    assert.deepEqual(
      resolveUserdataMenuIntent(registry, {
        intent: { kind: "delete", userdataId: "personal" },
        label: DELETE_USERDATA_LABEL,
      } as UserdataMenuItem),
      { kind: "delete", entry: registry.userdatas[1] },
    );
  });

  it("resolves empty, separator, and stale selections to cancel", () => {
    const separatorSelection: UserdataMenuItem = {
      kind: "separator",
      label: "Current window: Default (default)",
    };
    const staleSelection: UserdataMenuItem = {
      intent: { kind: "open", userdataId: "missing" },
      label: "Missing",
    };

    assert.deepEqual(resolveUserdataMenuIntent(registry, undefined), {
      kind: "cancel",
    });
    assert.deepEqual(resolveUserdataMenuIntent(registry, separatorSelection), {
      kind: "cancel",
    });
    assert.deepEqual(resolveUserdataMenuIntent(registry, staleSelection), {
      kind: "cancel",
    });
  });
});
