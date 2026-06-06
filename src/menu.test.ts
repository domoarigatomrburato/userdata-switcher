import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOpenWithUserdataMenuItems,
  CREATE_USERDATA_LABEL,
  RENAME_CURRENT_USERDATA_LABEL,
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

    const items = buildOpenWithUserdataMenuItems(onlyDefault, current);
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item"],
    );
    assert.equal(items[0]?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.equal(items[0]?.action, "rename");
    assert.equal(items[1]?.label, CREATE_USERDATA_LABEL);
    assert.equal(items[1]?.action, "create");
  });

  it("omits rename when the current userdata is unknown", () => {
    const items = buildOpenWithUserdataMenuItems(registry, null);
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item"],
    );
    assert.equal(items.at(-1)?.label, CREATE_USERDATA_LABEL);
    assert.equal(items.at(-1)?.action, "create");
    assert.ok(items.every((item) => item.action !== "rename"));
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
      defaultUserdata,
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item", "item"],
    );
    assert.equal(items.at(-2)?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.equal(items.at(-2)?.action, "rename");
    assert.equal(items.at(-1)?.label, CREATE_USERDATA_LABEL);
    assert.equal(items.at(-1)?.action, "create");
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
      current,
    );

    const managedItem = items[0];
    const renameItem = items.at(-2);
    const createItem = items.at(-1);

    assert.equal(managedItem?.label, CREATE_USERDATA_LABEL);
    assert.equal(managedItem?.userdataId, "literal-create-label");
    assert.equal(managedItem?.action, undefined);
    assert.equal(renameItem?.label, RENAME_CURRENT_USERDATA_LABEL);
    assert.equal(renameItem?.action, "rename");
    assert.equal(createItem?.label, CREATE_USERDATA_LABEL);
    assert.equal(createItem?.action, "create");
  });
});
