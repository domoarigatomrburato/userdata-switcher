import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenWithUserdataMenuItems } from "./menu";
import type { Registry } from "./registry";

const CREATE_LABEL = "Create New Userdata...";

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

  it("lists only the CTA when there are no other userdatas", () => {
    const onlyDefault: Registry = {
      version: 1,
      userdatas: [{ id: "default", kind: "default", label: "Default" }],
    };
    const [current] = onlyDefault.userdatas;
    assert.ok(current);

    const items = buildOpenWithUserdataMenuItems(
      onlyDefault,
      current,
      CREATE_LABEL,
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item"],
    );
    assert.equal(items[0]?.label, CREATE_LABEL);
  });

  it("lists other userdatas, a separator, and the CTA", () => {
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
      CREATE_LABEL,
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item"],
    );
    assert.equal(items.at(-1)?.label, CREATE_LABEL);
  });

  it("marks the create CTA with an action instead of relying on its label", () => {
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
            label: CREATE_LABEL,
            relativeDataDir: "userdata/literal-create-label/data",
          },
        ],
      },
      current,
      CREATE_LABEL,
    );

    const managedItem = items[0];
    const createItem = items.at(-1);

    assert.equal(managedItem?.label, CREATE_LABEL);
    assert.equal(managedItem?.userdataId, "literal-create-label");
    assert.equal(managedItem?.action, undefined);
    assert.equal(createItem?.label, CREATE_LABEL);
    assert.equal(createItem?.action, "create");
  });
});
