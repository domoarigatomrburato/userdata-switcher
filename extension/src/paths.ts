import os from "node:os";
import path from "node:path";

export function resolveStoreRoot(
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
): string {
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Cursor Userdata Switcher");
  }
  if (platform === "linux") {
    const dataHome = process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share");
    return path.join(dataHome, "cursor-userdata-switcher");
  }
  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local");
    return path.join(localAppData, "Cursor Userdata Switcher");
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function resolveDefaultUserdataRoot(
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
): string {
  if (platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Cursor");
  }
  if (platform === "linux") {
    const configHome = process.env.XDG_CONFIG_HOME ?? path.join(home, ".config");
    return path.join(configHome, "Cursor");
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return path.join(appData, "Cursor");
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function resolveManagedDataDir(storeRoot: string, relativeDataDir: string): string {
  return path.join(storeRoot, relativeDataDir);
}

export function registryPath(storeRoot: string): string {
  return path.join(storeRoot, "registry.json");
}
