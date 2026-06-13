import path from "node:path";

export function resolveManagedDataDir(
  storeRoot: string,
  relativeDataDir: string,
): string {
  const pathApi = pathApiForPath(storeRoot);
  const segments = relativeDataDir.split(/[\\/]+/);
  if (
    pathApi.isAbsolute(relativeDataDir) ||
    segments.length !== 2 ||
    segments[0] !== "u" ||
    !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(segments[1] ?? "")
  ) {
    throw new Error(`Invalid managed userdata path: ${relativeDataDir}`);
  }

  const resolvedStoreRoot = pathApi.resolve(storeRoot);
  const resolvedDataDir = pathApi.resolve(storeRoot, ...segments);
  const relativeFromStoreRoot = pathApi.relative(
    resolvedStoreRoot,
    resolvedDataDir,
  );
  if (
    !relativeFromStoreRoot ||
    relativeFromStoreRoot.startsWith("..") ||
    pathApi.isAbsolute(relativeFromStoreRoot)
  ) {
    throw new Error(`Invalid managed userdata path: ${relativeDataDir}`);
  }

  return pathApi.join(storeRoot, ...segments);
}

export function registryPath(storeRoot: string): string {
  return path.join(storeRoot, "registry.json");
}

export function pathApiForPath(candidate: string): typeof path.posix {
  return isWindowsPath(candidate) ? path.win32 : path;
}

function isWindowsPath(candidate: string): boolean {
  return /^[a-z]:[\\/]/i.test(candidate) || candidate.startsWith("\\\\");
}
