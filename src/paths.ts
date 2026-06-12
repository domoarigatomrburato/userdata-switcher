import path from "node:path";

export function resolveManagedDataDir(
  storeRoot: string,
  relativeDataDir: string,
): string {
  const segments = relativeDataDir.split(/[\\/]+/);
  if (
    path.isAbsolute(relativeDataDir) ||
    segments.length !== 2 ||
    segments[0] !== "u" ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(segments[1] ?? "")
  ) {
    throw new Error(`Invalid managed userdata path: ${relativeDataDir}`);
  }

  const resolvedStoreRoot = path.resolve(storeRoot);
  const resolvedDataDir = path.resolve(storeRoot, ...segments);
  const relativeFromStoreRoot = path.relative(
    resolvedStoreRoot,
    resolvedDataDir,
  );
  if (
    !relativeFromStoreRoot ||
    relativeFromStoreRoot.startsWith("..") ||
    path.isAbsolute(relativeFromStoreRoot)
  ) {
    throw new Error(`Invalid managed userdata path: ${relativeDataDir}`);
  }

  return path.join(storeRoot, ...segments);
}

export function registryPath(storeRoot: string): string {
  return path.join(storeRoot, "registry.json");
}
