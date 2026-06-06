import path from "node:path";

export function resolveManagedDataDir(
  storeRoot: string,
  relativeDataDir: string,
): string {
  return path.join(storeRoot, relativeDataDir);
}

export function registryPath(storeRoot: string): string {
  return path.join(storeRoot, "registry.json");
}
