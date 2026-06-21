import { pathsEqual, resolveManagedDataDir } from "./paths";
import type { Registry, UserdataEntry } from "./registry";

export type CurrentUserdata =
  | { kind: "known"; entry: UserdataEntry }
  | { kind: "unmanaged" };

export function deriveUserdataRootFromGlobalStorage(
  globalStoragePath: string,
): string | null {
  const index = globalStoragePath.search(/[\\/]User[\\/]globalStorage[\\/]/);
  return index === -1 ? null : globalStoragePath.slice(0, index);
}

export function matchCurrentUserdata(input: {
  globalStoragePath: string;
  defaultUserdataRoot: string;
  storeRoot: string;
  registry: Registry;
}): CurrentUserdata {
  const derivedRoot = deriveUserdataRootFromGlobalStorage(
    input.globalStoragePath,
  );
  if (!derivedRoot) {
    return { kind: "unmanaged" };
  }

  if (pathsEqual(derivedRoot, input.defaultUserdataRoot)) {
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
    let managedRoot: string;
    try {
      managedRoot = resolveManagedDataDir(
        input.storeRoot,
        entry.relativeDataDir,
      );
    } catch {
      continue;
    }
    if (pathsEqual(derivedRoot, managedRoot)) {
      return { kind: "known", entry };
    }
  }

  return { kind: "unmanaged" };
}

export function resolveUserdataEntryRoot(input: {
  entry: UserdataEntry;
  storeRoot: string;
  defaultUserdataRoot: string;
}): string | null {
  if (input.entry.kind === "default") {
    return input.defaultUserdataRoot;
  }

  return input.entry.relativeDataDir
    ? resolveManagedDataDir(input.storeRoot, input.entry.relativeDataDir)
    : null;
}

export function resolveCurrentUserdataRoot(input: {
  current: CurrentUserdata;
  globalStoragePath: string;
  defaultUserdataRoot: string;
  storeRoot: string;
}): string | null {
  const { current, globalStoragePath, defaultUserdataRoot, storeRoot } = input;

  if (current.kind === "unmanaged") {
    return deriveUserdataRootFromGlobalStorage(globalStoragePath);
  }

  return resolveUserdataEntryRoot({
    entry: current.entry,
    storeRoot,
    defaultUserdataRoot,
  });
}
