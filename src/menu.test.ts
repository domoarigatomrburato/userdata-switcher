import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ACTIONS_SEPARATOR_LABEL,
  buildOpenWithUserdataMenuItems,
  CREATE_USERDATA_LABEL,
  RENAME_CURRENT_USERDATA_LABEL,
  resolveOpenWithUserdataMenuIntent,
  type UserdataMenuItem,
} from "./menu";
import type { Registry } from "./registry";

describe("buildOpenWithUserdataMenuItems", () => {
  const registry: Registry = {
    version: 1,
    userdatas: [
      { id: "default", kind: "default", label: "Default" },
      {
        id: "personal",
        kind: "managed",
        label: "Personal",
        relativeDataDir: "userdata/personal/data",
      },
    ],
  };

  it("lists rename and create when there are no other userdatas", () => {
    const onlyDefault: Registry = {
      version: 1,
      userdatas: [{ id: "default", kind: "default", label: "Default" }],
    };
    const [current] = onlyDefault.userdatas;
    assert.ok(current);

    const items = buildOpenWithUserdataMenuItems(onlyDefault, {
      kind: "known",
      entry: current,
    });
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["separator", "item", "item"],
    );
    assert.equal(items[0]?.label, "Actions");
    assert.equal(items[1]?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.deepEqual(items[1]?.intent, { kind: "rename" });
    assert.equal(items[2]?.label, CREATE_USERDATA_LABEL);
    assert.deepEqual(items[2]?.intent, { kind: "create" });
  });

  it("omits rename when the current userdata is unknown", () => {
    const items = buildOpenWithUserdataMenuItems(registry, {
      kind: "unmanaged",
    });
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item"],
    );
    assert.equal(items.at(-1)?.label, CREATE_USERDATA_LABEL);
    assert.equal(items.at(-2)?.label, "Actions");
    assert.deepEqual(items.at(-1)?.intent, { kind: "create" });
    assert.ok(items.every((item) => item.intent?.kind !== "rename"));
  });

  it("lists other userdatas, a separator, rename, and create", () => {
    const [defaultUserdata, personalUserdata] = registry.userdatas;
    assert.ok(defaultUserdata);
    assert.ok(personalUserdata);

    const items = buildOpenWithUserdataMenuItems(
      {
        version: 1,
        userdatas: [
          defaultUserdata,
          personalUserdata,
          {
            id: "work",
            kind: "managed",
            label: "Work",
            relativeDataDir: "userdata/work/data",
          },
        ],
      },
      { kind: "known", entry: defaultUserdata },
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item", "item"],
    );
    assert.equal(items.at(-2)?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.deepEqual(items.at(-2)?.intent, { kind: "rename" });
    assert.equal(items.at(-1)?.label, CREATE_USERDATA_LABEL);
    assert.deepEqual(items.at(-1)?.intent, { kind: "create" });
  });

  it("marks action CTAs with structured action data instead of relying on labels", () => {
    const current = registry.userdatas[0];
    assert.ok(current);

    const items = buildOpenWithUserdataMenuItems(
      {
        version: 1,
        userdatas: [
          current,
          {
            id: "literal-create-label",
            kind: "managed",
            label: CREATE_USERDATA_LABEL,
            relativeDataDir: "userdata/literal-create-label/data",
          },
        ],
      },
      { kind: "known", entry: current },
    );

    const managedItem = items[0];
    const renameItem = items.at(-2);
    const createItem = items.at(-1);

    assert.equal(managedItem?.label, CREATE_USERDATA_LABEL);
    assert.deepEqual(managedItem?.intent, {
      kind: "open",
      userdataId: "literal-create-label",
    });
    assert.equal(renameItem?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.deepEqual(renameItem?.intent, { kind: "rename" });
    assert.equal(createItem?.label, CREATE_USERDATA_LABEL);
    assert.deepEqual(createItem?.intent, { kind: "create" });
  });
});

describe("resolveOpenWithUserdataMenuIntent", () => {
  const registry: Registry = {
    version: 1,
    userdatas: [
      { id: "default", kind: "default", label: "Default" },
      {
        id: "personal",
        kind: "managed",
        label: CREATE_USERDATA_LABEL,
        relativeDataDir: "userdata/personal/data",
      },
    ],
  };

  it("resolves a selected userdata item to an open intent", () => {
    const [current] = registry.userdatas;
    assert.ok(current);
    const items = buildOpenWithUserdataMenuItems(registry, {
      kind: "known",
      entry: current,
    });

    assert.deepEqual(resolveOpenWithUserdataMenuIntent(registry, items[0]), {
      kind: "open",
      entry: registry.userdatas[1],
    });
  });

  it("resolves structured action items without matching labels", () => {
    const items = buildOpenWithUserdataMenuItems(registry, {
      kind: "unmanaged",
    });

    assert.deepEqual(resolveOpenWithUserdataMenuIntent(registry, items[0]), {
      kind: "open",
      entry: registry.userdatas[0],
    });
    assert.deepEqual(
      resolveOpenWithUserdataMenuIntent(registry, items.at(-1)),
      {
        kind: "create",
      },
    );
  });

  it("resolves empty, separator, and stale selections to cancel", () => {
    const separatorSelection: UserdataMenuItem = {
      kind: "separator",
      label: ACTIONS_SEPARATOR_LABEL,
    };
    const staleSelection: UserdataMenuItem = {
      intent: { kind: "open", userdataId: "missing" },
      label: "Missing",
    };

    assert.deepEqual(resolveOpenWithUserdataMenuIntent(registry, undefined), {
      kind: "cancel",
    });
    assert.deepEqual(
      resolveOpenWithUserdataMenuIntent(registry, separatorSelection),
      { kind: "cancel" },
    );
    assert.deepEqual(
      resolveOpenWithUserdataMenuIntent(registry, staleSelection),
      { kind: "cancel" },
    );
  });
});
