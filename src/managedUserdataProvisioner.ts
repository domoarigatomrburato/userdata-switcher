import fs from "node:fs";
import { resolveManagedDataDir } from "./paths";
import { seedUserdataPreferences } from "./preferences";
import {
  type ManagedUserdataEntry,
  planManagedUserdataCreation,
  type Registry,
} from "./registry";
import type { UserdataRegistryStore } from "./registryStore";

export interface ManagedUserdataProvisioning {
  entry: ManagedUserdataEntry;
  managedDataDir: string;
  registry: Registry;
}

export function provisionManagedUserdata(input: {
  label: string;
  mkdirSync?: typeof fs.mkdirSync;
  registryStore: UserdataRegistryStore;
  sourceUserdataRoot?: string;
  storeRoot: string;
}): ManagedUserdataProvisioning {
  const mkdir = input.mkdirSync ?? fs.mkdirSync;

  return input.registryStore.updateWithResult((latest) => {
    const creation = planManagedUserdataCreation(latest, input.label);
    const managedDataDir = resolveManagedDataDir(
      input.storeRoot,
      creation.entry.relativeDataDir,
    );

    mkdir(managedDataDir, { recursive: true });
    if (input.sourceUserdataRoot) {
      seedUserdataPreferences({
        sourceUserdataRoot: input.sourceUserdataRoot,
        targetUserdataRoot: managedDataDir,
      });
    }

    return {
      registry: creation.registry,
      result: {
        ...creation,
        managedDataDir,
      },
    };
  });
}
