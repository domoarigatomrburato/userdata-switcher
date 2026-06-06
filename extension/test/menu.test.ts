import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOpenWithUserdataMenuItems } from "../src/menu";
import type { Registry } from "../src/registry";

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
    const items = buildOpenWithUserdataMenuItems(
      onlyDefault,
      onlyDefault.userdatas[0]!,
      CREATE_LABEL,
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item"],
    );
    assert.equal(items[0]?.label, CREATE_LABEL);
  });

  it("lists other userdatas, a separator, and the CTA", () => {
    const items = buildOpenWithUserdataMenuItems(
      {
        version: 1,
        userdatas: [
          registry.userdatas[0]!,
          registry.userdatas[1]!,
          { id: "work", kind: "managed", label: "Work", relativeDataDir: "userdata/work/data" },
        ],
      },
      registry.userdatas[0]!,
      CREATE_LABEL,
    );
    assert.deepEqual(
      items.map((item) => item.kind ?? "item"),
      ["item", "item", "separator", "item"],
    );
    assert.equal(items.at(-1)?.label, CREATE_LABEL);
  });
});
