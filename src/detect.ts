import path from "node:path";
import { resolveManagedDataDir } from "./paths";
import type { Registry, UserdataEntry } from "./registry";

export type CurrentUserdataMatch =
  | { kind: "known"; entry: UserdataEntry }
  | { kind: "unmanaged" };

export function deriveUserdataRootFromGlobalStorage(
  globalStoragePath: string,
): string | null {
  const marker = `${path.sep}User${path.sep}globalStorage${path.sep}`;
  const index = globalStoragePath.indexOf(marker);
  return index === -1 ? null : globalStoragePath.slice(0, index);
}

export function matchCurrentUserdata(input: {
  globalStoragePath: string;
  defaultUserdataRoot: string;
  storeRoot: string;
  registry: Registry;
}): CurrentUserdataMatch {
  const derivedRoot = deriveUserdataRootFromGlobalStorage(
    input.globalStoragePath,
  );
  if (!derivedRoot) {
    return { kind: "unmanaged" };
  }

  const normalizedDerived = path.resolve(derivedRoot);
  if (pathsEqual(normalizedDerived, input.defaultUserdataRoot)) {
    const defaultEntry = input.registry.userdatas.find(
      (entry) => entry.kind === "default",
    );
    if (defaultEntry) {
      return { kind: "known", entry: defaultEntry };
    }
  }

  for (const entry of input.registry.userdatas) {
    if (entry.kind !== "managed" || !entry.relativeDataDir) {
      continue;
    }
    const managedRoot = resolveManagedDataDir(
      input.storeRoot,
      entry.relativeDataDir,
    );
    if (pathsEqual(normalizedDerived, managedRoot)) {
      return { kind: "known", entry };
    }
  }

  return { kind: "unmanaged" };
}

function pathsEqual(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}
