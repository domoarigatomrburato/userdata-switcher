import os from "node:os";
import path from "node:path";
import type { EditorHost } from "./host";

export function resolveStoreRoot(
  host: EditorHost,
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const pathApi = pathForPlatform(platform);
  if (platform === "darwin") {
    return pathApi.join(
      home,
      "Library",
      "Application Support",
      "Userdata Switcher",
      host.storageName,
    );
  }
  if (platform === "linux") {
    const dataHome = env.XDG_DATA_HOME ?? pathApi.join(home, ".local", "share");
    return pathApi.join(dataHome, "userdata-switcher", host.storageSlug);
  }
  if (platform === "win32") {
    const localAppData =
      env.LOCALAPPDATA ?? pathApi.join(home, "AppData", "Local");
    return pathApi.join(localAppData, "Userdata Switcher", host.storageName);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function resolveDefaultUserdataRoot(
  host: EditorHost,
  platform: NodeJS.Platform = process.platform,
  home: string = os.homedir(),
  env: NodeJS.ProcessEnv = process.env,
): string {
  const pathApi = pathForPlatform(platform);
  if (platform === "darwin") {
    return pathApi.join(
      home,
      "Library",
      "Application Support",
      host.defaultUserdataDirName,
    );
  }
  if (platform === "linux") {
    const configHome = env.XDG_CONFIG_HOME ?? pathApi.join(home, ".config");
    return pathApi.join(configHome, host.defaultUserdataDirName);
  }
  if (platform === "win32") {
    const appData = env.APPDATA ?? pathApi.join(home, "AppData", "Roaming");
    return pathApi.join(appData, host.defaultUserdataDirName);
  }
  throw new Error(`Unsupported platform: ${platform}`);
}

export function resolveManagedDataDir(
  storeRoot: string,
  relativeDataDir: string,
): string {
  return path.join(storeRoot, relativeDataDir);
}

export function registryPath(storeRoot: string): string {
  return path.join(storeRoot, "registry.json");
}

function pathForPlatform(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}
