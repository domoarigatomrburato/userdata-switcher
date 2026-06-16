import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  addManagedUserdata,
  ensureDefaultUserdata,
  loadRegistry,
  removeUserdata,
  renameUserdata,
} from "./registry";

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "userdata-switcher-registry-test-"),
);

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function registryFile(name: string): string {
  return path.join(tempDir, `${name}.json`);
}

describe("registry", () => {
  it("auto-seeds the default userdata entry", () => {
    const registry = ensureDefaultUserdata(
      loadRegistry(registryFile("default")),
    );
    assert.equal(registry.userdatas.length, 1);
    assert.deepEqual(registry.userdatas[0], {
      id: "default",
      kind: "default",
      label: "Default",
    });
  });

  it("creates a managed userdata with a stable relative path", () => {
    const registry = ensureDefaultUserdata({ version: 1, userdatas: [] });
    const updated = addManagedUserdata(registry, "Personal");
    assert.equal(updated.userdatas.length, 2);
    const managed = updated.userdatas.find((entry) => entry.kind === "managed");
    assert.ok(managed);
    assert.equal(managed?.label, "Personal");
    assert.match(managed?.relativeDataDir ?? "", /^u\/personal$/);
  });

  it("caps managed userdata ids so macOS socket paths stay short", () => {
    const longRegistry = ensureDefaultUserdata({
      version: 1,
      userdatas: [],
    });
    const updated = addManagedUserdata(
      longRegistry,
      "A very very very very long personal workspace",
    );
    const updatedAgain = addManagedUserdata(
      updated,
      "A very very very very long personal workspace",
    );

    assert.deepEqual(
      updatedAgain.userdatas
        .filter((entry) => entry.kind === "managed")
        .map((entry) => ({
          id: entry.id,
          relativeDataDir: entry.relativeDataDir,
        })),
      [
        {
          id: "a-very-very-very-very",
          relativeDataDir: "u/a-very-very-very-very",
        },
        {
          id: "a-very-very-very-ver-2",
          relativeDataDir: "u/a-very-very-very-ver-2",
        },
      ],
    );
  });

  it("renames a userdata label without changing ids", () => {
    const registry = {
      version: 1 as const,
      userdatas: [
        { id: "default", kind: "default" as const, label: "Default" },
      ],
    };
    const updated = renameUserdata(registry, "default", "Work");
    assert.equal(updated.userdatas[0]?.label, "Work");
    assert.equal(updated.userdatas[0]?.id, "default");
  });

  it("removes a userdata by its ID", () => {
    const registry = {
      version: 1 as const,
      userdatas: [
        { id: "default", kind: "default" as const, label: "Default" },
        {
          id: "personal",
          kind: "managed" as const,
          label: "Personal",
          relativeDataDir: "u/personal",
        },
      ],
    };
    const updated = removeUserdata(registry, "personal");
    assert.equal(updated.userdatas.length, 1);
    assert.equal(updated.userdatas[0]?.id, "default");
  });
});
