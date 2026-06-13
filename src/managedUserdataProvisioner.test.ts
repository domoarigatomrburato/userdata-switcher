import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { provisionManagedUserdata } from "./managedUserdataProvisioner";
import { loadRegistry, saveRegistry } from "./registry";
import { UserdataRegistryStore } from "./registryStore";

const tempDir = fs.mkdtempSync(
  path.join(os.tmpdir(), "userdata-switcher-provisioner-test-"),
);

after(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function registryFile(name: string): string {
  return path.join(tempDir, `${name}.json`);
}

describe("provisionManagedUserdata", () => {
  it("creates the directory before persisting the registry entry", () => {
    const file = registryFile("create");
    const storeRoot = path.join(tempDir, "store-create");
    const store = new UserdataRegistryStore(file);

    const result = provisionManagedUserdata({
      label: "Personal",
      registryStore: store,
      storeRoot,
    });

    assert.equal(result.entry.id, "personal");
    assert.equal(result.managedDataDir, path.join(storeRoot, "u/personal"));
    assert.equal(fs.existsSync(result.managedDataDir), true);
    assert.deepEqual(
      loadRegistry(file).userdatas.map((entry) => entry.id),
      ["default", "personal"],
    );
  });

  it("does not persist the registry entry when directory creation fails", () => {
    const file = registryFile("mkdir-fails");
    const originalRegistry = {
      version: 1 as const,
      userdatas: [
        { id: "default", kind: "default" as const, label: "Default" },
      ],
    };
    saveRegistry(file, originalRegistry);

    assert.throws(
      () =>
        provisionManagedUserdata({
          label: "Personal",
          mkdirSync: () => {
            throw new Error("mkdir failed");
          },
          registryStore: new UserdataRegistryStore(file),
          storeRoot: path.join(tempDir, "store-mkdir-fails"),
        }),
      /mkdir failed/,
    );

    assert.deepEqual(loadRegistry(file), originalRegistry);
  });
});
