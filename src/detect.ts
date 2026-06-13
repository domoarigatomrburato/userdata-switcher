import path from "node:path";
import { pathApiForPath, resolveManagedDataDir } from "./paths";
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

  if (current.entry.kind === "default") {
    return defaultUserdataRoot;
  }

  return current.entry.relativeDataDir
    ? resolveManagedDataDir(storeRoot, current.entry.relativeDataDir)
    : null;
}

function pathsEqual(left: string, right: string): boolean {
  const pathApi =
    pathApiForPath(left) === path.win32 ? path.win32 : pathApiForPath(right);
  const normalizedLeft = pathApi.resolve(left);
  const normalizedRight = pathApi.resolve(right);
  return pathApi === path.win32
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}
