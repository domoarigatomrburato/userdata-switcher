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
  existsSync?: (candidate: string) => boolean;
  logger?: CliDiscoveryLogger;
  platform?: NodeJS.Platform;
}

export interface CliDiscoveryLogger {
  info(message: string): void;
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
  discoverEditorCli(appRoot: string, deps?: CliDiscoveryDeps): string | null;
}

interface HostDefinition {
  id: EditorHostId;
  displayName: string;
  storageSlug: string;
  defaultUserdataDirName: string;
  sharedExtensionsRelativePath: string;
  cliNames: string[];
  windowsExecutableNames: string[];
}

const HOST_DEFINITIONS: HostDefinition[] = [
  {
    id: "cursor",
    displayName: "Cursor",
    storageSlug: "cursor",
    defaultUserdataDirName: "Cursor",
    sharedExtensionsRelativePath: ".cursor/extensions",
    cliNames: ["cursor"],
    windowsExecutableNames: ["Cursor.exe"],
  },
  {
    id: "vscode",
    displayName: "Visual Studio Code",
    storageSlug: "vscode",
    defaultUserdataDirName: "Code",
    sharedExtensionsRelativePath: ".vscode/extensions",
    cliNames: ["code"],
    windowsExecutableNames: ["Code.exe"],
  },
  {
    id: "vscode-insiders",
    displayName: "Visual Studio Code - Insiders",
    storageSlug: "vscode-insiders",
    defaultUserdataDirName: "Code - Insiders",
    sharedExtensionsRelativePath: ".vscode-insiders/extensions",
    cliNames: ["code-insiders"],
    windowsExecutableNames: ["Code - Insiders.exe"],
  },
];

export function resolveEditorHost(
  identity: EditorHostIdentity,
): SupportedHostAdapter | null {
  const definition =
    HOST_DEFINITIONS.find((host) => host.id === identity.uriScheme) ??
    HOST_DEFINITIONS.find((host) => host.displayName === identity.appName);
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
      "udsw",
      host.storageSlug,
    );
  }
  if (platform === "linux") {
    const dataHome = env.XDG_DATA_HOME ?? pathApi.join(home, ".local", "share");
    return pathApi.join(dataHome, "udsw", host.storageSlug);
  }
  if (platform === "win32") {
    const localAppData =
      env.LOCALAPPDATA ?? pathApi.join(home, "AppData", "Local");
    return pathApi.join(localAppData, "udsw", host.storageSlug);
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
  const directories = bundledCliDirectories(appRoot, platform);
  deps.logger?.info(
    `CLI discovery bundled CLI directories: ${directories.map(formatDiagnosticValue).join(", ")}`,
  );
  return findExecutableInDirectories({
    directories,
    env: deps.env ?? process.env,
    existsSync: deps.existsSync ?? fs.existsSync,
    logger: deps.logger,
    names: host.cliNames,
    platform,
    purpose: "bundled CLI",
  });
}

function bundledCliDirectories(
  appRoot: string,
  platform: NodeJS.Platform,
): string[] {
  const pathApi = pathForPlatform(platform);
  const appRootBin = pathApi.join(appRoot, "bin");

  if (platform !== "win32") {
    return [appRootBin];
  }

  const appRootParent = pathApi.dirname(appRoot);
  const appRootLooksLikeResourcesApp =
    pathApi.basename(appRoot).toLowerCase() === "app" &&
    pathApi.basename(appRootParent).toLowerCase() === "resources";

  if (!appRootLooksLikeResourcesApp) {
    return [appRootBin];
  }

  return [pathApi.join(pathApi.dirname(appRootParent), "bin"), appRootBin];
}

function discoverEditorCli(
  host: HostDefinition,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  const platform = deps.platform ?? process.platform;
  const env = deps.env ?? process.env;
  const existsSync = deps.existsSync ?? fs.existsSync;
  const logger = deps.logger;

  logger?.info(
    `CLI discovery start: host=${host.displayName} platform=${platform} appRoot=${formatDiagnosticValue(appRoot)} cliNames=${host.cliNames.join(", ")} windowsExecutableNames=${host.windowsExecutableNames.join(", ")}`,
  );

  const bundledEditorExecutable = discoverBundledEditorExecutable(
    host,
    appRoot,
    { ...deps, env, existsSync, logger, platform },
  );
  if (bundledEditorExecutable) {
    logger?.info(
      `CLI discovery selected Windows app executable: ${bundledEditorExecutable}`,
    );
    return bundledEditorExecutable;
  }
  const bundledCli = discoverBundledCli(host, appRoot, deps);
  if (bundledCli) {
    logger?.info(`CLI discovery selected bundled CLI: ${bundledCli}`);
    return bundledCli;
  }
  logPathDiscoverySummary(env, platform, logger);
  logger?.info("CLI discovery checking PATH fallback");
  const pathEditor = findEditorOnPath({
    env,
    existsSync,
    logger,
    names: host.cliNames,
    platform,
  });
  if (pathEditor) {
    logger?.info(`CLI discovery selected PATH executable: ${pathEditor}`);
    return pathEditor;
  }

  logger?.info("CLI discovery failed: no editor executable found");
  return null;
}

function discoverBundledEditorExecutable(
  host: HostDefinition,
  appRoot: string,
  deps: CliDiscoveryDeps = fs,
): string | null {
  const platform = deps.platform ?? process.platform;
  if (platform !== "win32") {
    return null;
  }
  const directories = windowsEditorExecutableDirectories(appRoot);
  deps.logger?.info(
    `CLI discovery Windows app executable directories: ${directories.map(formatDiagnosticValue).join(", ")}`,
  );
  return findExactFilesInDirectories({
    directories,
    existsSync: deps.existsSync ?? fs.existsSync,
    filenames: host.windowsExecutableNames,
    logger: deps.logger,
    platform,
    purpose: "Windows app executable",
  });
}

function windowsEditorExecutableDirectories(appRoot: string): string[] {
  const pathApi = pathForPlatform("win32");
  const appRootParent = pathApi.dirname(appRoot);
  const appRootLooksLikeResourcesApp =
    pathApi.basename(appRoot).toLowerCase() === "app" &&
    pathApi.basename(appRootParent).toLowerCase() === "resources";

  return appRootLooksLikeResourcesApp
    ? [pathApi.dirname(appRootParent)]
    : [appRoot];
}

function findEditorOnPath(input: {
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  logger?: CliDiscoveryLogger;
  names: string[];
  platform: NodeJS.Platform;
}): string | null {
  const pathValue = input.env.PATH ?? input.env.Path ?? input.env.path;
  if (!pathValue) {
    input.logger?.info("CLI discovery PATH fallback skipped: PATH is empty");
    return null;
  }
  const delimiter = input.platform === "win32" ? ";" : ":";
  return findExecutableInDirectories({
    directories: pathValue.split(delimiter).filter(Boolean),
    env: input.env,
    existsSync: input.existsSync,
    logger: input.logger,
    names: input.names,
    platform: input.platform,
    purpose: "PATH",
  });
}

function findExactFilesInDirectories(input: {
  directories: string[];
  existsSync: (candidate: string) => boolean;
  filenames: string[];
  logger?: CliDiscoveryLogger;
  platform: NodeJS.Platform;
  purpose: string;
}): string | null {
  const pathApi = pathForPlatform(input.platform);

  for (const directory of input.directories) {
    for (const filename of input.filenames) {
      const candidate = pathApi.join(directory, filename);
      const exists = input.existsSync(candidate);
      input.logger?.info(
        `CLI discovery checked ${input.purpose}: ${formatDiagnosticValue(candidate)} exists=${exists}`,
      );
      if (exists) {
        return candidate;
      }
    }
  }
  return null;
}

function findExecutableInDirectories(input: {
  directories: string[];
  env: NodeJS.ProcessEnv;
  existsSync: (candidate: string) => boolean;
  logger?: CliDiscoveryLogger;
  names: string[];
  platform: NodeJS.Platform;
  purpose: string;
}): string | null {
  const extensions = executableExtensions(input.platform, input.env);
  const pathApi = pathForPlatform(input.platform);

  for (const directory of input.directories) {
    for (const name of input.names) {
      for (const extension of extensions) {
        const candidate = pathApi.join(directory, `${name}${extension}`);
        const exists = input.existsSync(candidate);
        input.logger?.info(
          `CLI discovery checked ${input.purpose}: ${formatDiagnosticValue(candidate)} exists=${exists}`,
        );
        if (exists) {
          return candidate;
        }
      }
    }
  }
  return null;
}

function logPathDiscoverySummary(
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  logger?: CliDiscoveryLogger,
): void {
  if (!logger) {
    return;
  }
  const pathKey = ["PATH", "Path", "path"].find((key) => env[key]);
  const pathValue = pathKey ? env[pathKey] : undefined;
  const delimiter = platform === "win32" ? ";" : ":";
  const pathEntryCount =
    pathValue?.split(delimiter).filter(Boolean).length ?? 0;
  logger.info(
    `CLI discovery PATH summary: key=${pathKey ?? "(none)"} entries=${pathEntryCount} PATHEXT=${env.PATHEXT ?? "(default)"}`,
  );
}

function formatDiagnosticValue(value: string): string {
  return JSON.stringify(value);
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
