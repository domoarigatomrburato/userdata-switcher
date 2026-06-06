import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type EditorHostId = "cursor" | "vscode" | "vscode-insiders";

export interface EditorHostIdentity {
  appName: string;
  uriScheme: string;
}

export interface PathResolutionOptions {
  platform?: NodeJS.Platform;
  home?: string;
  env?: NodeJS.ProcessEnv;
}

export interface CliDiscoveryDeps {
  env?: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  platform?: NodeJS.Platform;
}

export interface SupportedHostAdapter {
  readonly id: EditorHostId;
  readonly displayName: string;
  readonly cliNames: readonly string[];
  resolveStoreRoot(options?: PathResolutionOptions): string;
  resolveDefaultUserdataRoot(options?: PathResolutionOptions): string;
  resolveSharedExtensionsDirectory(
    options?: PathResolutionOptions,
  ): string | null;
  discoverBundledCli(appRoot: string, deps?: CliDiscoveryDeps): string | null;
  discoverEditorCli(appRoot: string, deps?: CliDiscoveryDeps): string | null;
}

interface HostDefinition {
  id: EditorHostId;
  displayName: string;
  storageName: string;
  storageSlug: string;
  defaultUserdataDirName: string;
  sharedExtensionsRelativePath: string;
  cliNames: string[];
}

const HOST_DEFINITIONS: HostDefinition[] = [
  {
    id: "cursor",
    displayName: "Cursor",
    storageName: "Cursor",
    storageSlug: "cursor",
    defaultUserdataDirName: "Cursor",
    sharedExtensionsRelativePath: ".cursor/extensions",
    cliNames: ["cursor"],
  },
  {
    id: "vscode",
    displayName: "Visual Studio Code",
    storageName: "Visual Studio Code",
    storageSlug: "vscode",
    defaultUserdataDirName: "Code",
    sharedExtensionsRelativePath: ".vscode/extensions",
    cliNames: ["code"],
  },
  {
    id: "vscode-insiders",
    displayName: "Visual Studio Code - Insiders",
    storageName: "Visual Studio Code - Insiders",
    storageSlug: "vscode-insiders",
    defaultUserdataDirName: "Code - Insiders",
    sharedExtensionsRelativePath: ".vscode-insiders/extensions",
    cliNames: ["code-insiders"],
  },
];

export function resolveEditorHost(
  identity: EditorHostIdentity,
): SupportedHostAdapter | null {
  const definition =
    HOST_DEFINITIONS.find((host) => host.id === identity.uriScheme) ??
    HOST_DEFINITIONS.find((host) => host.displayName === identity.appName) ??
    null;
  return definition ? createSupportedHostAdapter(definition) : null;
}

function createSupportedHostAdapter(
  definition: HostDefinition,
): SupportedHostAdapter {
  return {
    id: definition.id,
    displayName: definition.displayName,
    cliNames: definition.cliNames,
    resolveStoreRoot: (options) => resolveStoreRoot(definition, options),
    resolveDefaultUserdataRoot: (options) =>
      resolveDefaultUserdataRoot(definition, options),
    resolveSharedExtensionsDirectory: (options) =>
      resolveSharedExtensionsDirectory(definition, options),
    discoverBundledCli: (appRoot, deps) =>
      discoverBundledCli(definition, appRoot, deps),
    discoverEditorCli: (appRoot, deps) =>
      discoverEditorCli(definition, appRoot, deps),
  };
}

function resolvePathContext(options?: PathResolutionOptions): {
  platform: NodeJS.Platform;
  home: string;
  env: NodeJS.ProcessEnv;
} {
  return {
    platform: options?.platform ?? process.platform,
    home: options?.home ?? os.homedir(),
    env: options?.env ?? process.env,
  };
}

function resolveStoreRoot(
  host: HostDefinition,
  options?: PathResolutionOptions,
): string {
  const { platform, home, env } = resolvePathContext(options);
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

function resolveDefaultUserdataRoot(
  host: HostDefinition,
  options?: PathResolutionOptions,
): string {
  const { platform, home, env } = resolvePathContext(options);
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

function resolveSharedExtensionsDirectory(
  host: HostDefinition,
  options?: PathResolutionOptions,
): string | null {
  const { platform, home } = resolvePathContext(options);
  const pathApi = pathForPlatform(platform);
  return pathApi.join(home, host.sharedExtensionsRelativePath);
}

function discoverBundledCli(
  host: HostDefinition,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  const platform = deps.platform ?? process.platform;
  return findExecutableInDirectories({
    directories: [pathForPlatform(platform).join(appRoot, "bin")],
    env: deps.env ?? process.env,
    existsSync: deps.existsSync,
    names: host.cliNames,
    platform,
  });
}

function discoverEditorCli(
  host: HostDefinition,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  const bundledCli = discoverBundledCli(host, appRoot, deps);
  if (bundledCli) {
    return bundledCli;
  }
  const platform = deps.platform ?? process.platform;
  return findEditorOnPath({
    env: deps.env ?? process.env,
    existsSync: deps.existsSync,
    names: host.cliNames,
    platform,
  });
}

function findEditorOnPath(input: {
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  names: string[];
  platform: NodeJS.Platform;
}): string | null {
  const pathValue = input.env.PATH ?? input.env.Path ?? input.env.path;
  if (!pathValue) {
    return null;
  }
  const delimiter = input.platform === "win32" ? ";" : ":";
  return findExecutableInDirectories({
    directories: pathValue.split(delimiter).filter(Boolean),
    env: input.env,
    existsSync: input.existsSync,
    names: input.names,
    platform: input.platform,
  });
}

function findExecutableInDirectories(input: {
  directories: string[];
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  names: string[];
  platform: NodeJS.Platform;
}): string | null {
  const extensions = executableExtensions(input.platform, input.env);
  const pathApi = pathForPlatform(input.platform);

  for (const directory of input.directories) {
    for (const name of input.names) {
      for (const extension of extensions) {
        const candidate = pathApi.join(directory, `${name}${extension}`);
        if (input.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function executableExtensions(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
): string[] {
  if (platform !== "win32") {
    return [""];
  }
  return (env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
    .split(";")
    .filter(Boolean)
    .map((extension) => extension.toLowerCase());
}

function pathForPlatform(platform: NodeJS.Platform): typeof path.posix {
  return platform === "win32" ? path.win32 : path.posix;
}
