import fs from "node:fs";
import path from "node:path";

export type UserdataKind = "default" | "managed";

export interface UserdataEntry {
  id: string;
  kind: UserdataKind;
  label: string;
  relativeDataDir?: string;
}

export interface ManagedUserdataEntry extends UserdataEntry {
  kind: "managed";
  relativeDataDir: string;
}

export interface Registry {
  version: 1;
  userdatas: UserdataEntry[];
}

export interface ManagedUserdataCreation {
  registry: Registry;
  entry: ManagedUserdataEntry;
}

export interface ManagedUserdataCreationOptions {
  beforeSave?(entry: ManagedUserdataEntry): void;
}

interface RegistryUpdateResult<T> {
  registry: Registry;
  result: T;
}

const DEFAULT_ENTRY: UserdataEntry = {
  id: "default",
  kind: "default",
  label: "Default",
};
const MAX_MANAGED_ID_LENGTH = 22;

export function loadRegistry(registryFile: string): Registry {
  if (!fs.existsSync(registryFile)) {
    return { version: 1, userdatas: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(registryFile, "utf8")) as Registry;
  return {
    version: 1,
    userdatas: Array.isArray(parsed.userdatas) ? parsed.userdatas : [],
  };
}

export function saveRegistry(registryFile: string, registry: Registry): void {
  fs.mkdirSync(path.dirname(registryFile), { recursive: true });
  const tempFile = `${registryFile}.${process.pid}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
  fs.renameSync(tempFile, registryFile);
}

export function updateRegistry(
  registryFile: string,
  update: (latest: Registry) => Registry,
): Registry {
  return updateRegistryWithResult(registryFile, (latest) => {
    const registry = update(latest);
    return { registry, result: registry };
  }).result;
}

function updateRegistryWithResult<T>(
  registryFile: string,
  update: (latest: Registry) => RegistryUpdateResult<T>,
): RegistryUpdateResult<T> {
  const latest = ensureDefaultUserdata(loadRegistry(registryFile));
  const updated = update(latest);
  saveRegistry(registryFile, updated.registry);
  return updated;
}

export function ensureDefaultUserdata(registry: Registry): Registry {
  if (registry.userdatas.some((entry) => entry.kind === "default")) {
    return registry;
  }
  return {
    version: 1,
    userdatas: [DEFAULT_ENTRY, ...registry.userdatas],
  };
}

export function addManagedUserdata(
  registry: Registry,
  label: string,
): Registry {
  return buildManagedUserdataCreation(registry, label).registry;
}

export function createManagedUserdata(
  registryFile: string,
  label: string,
  options: ManagedUserdataCreationOptions = {},
): ManagedUserdataCreation {
  return updateRegistryWithResult(registryFile, (latest) => {
    const creation = buildManagedUserdataCreation(latest, label);
    options.beforeSave?.(creation.entry);
    return { registry: creation.registry, result: creation };
  }).result;
}

function trimmedUserdataLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Userdata label is required");
  }
  return trimmed;
}

export function renameUserdata(
  registry: Registry,
  entryId: string,
  label: string,
): Registry {
  const trimmed = trimmedUserdataLabel(label);
  return {
    version: 1,
    userdatas: registry.userdatas.map((entry) =>
      entry.id === entryId ? { ...entry, label: trimmed } : entry,
    ),
  };
}

function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_MANAGED_ID_LENGTH)
    .replace(/-+$/g, "");
  return slug || "userdata";
}

function buildManagedUserdataEntry(
  registry: Registry,
  label: string,
): ManagedUserdataEntry {
  const trimmed = trimmedUserdataLabel(label);
  const id = createUniqueId(registry, slugifyLabel(trimmed));
  return {
    id,
    kind: "managed",
    label: trimmed,
    relativeDataDir: `u/${id}`,
  };
}

function buildManagedUserdataCreation(
  registry: Registry,
  label: string,
): ManagedUserdataCreation {
  const entry = buildManagedUserdataEntry(registry, label);
  return {
    registry: {
      version: 1,
      userdatas: [...registry.userdatas, entry],
    },
    entry,
  };
}

function createUniqueId(registry: Registry, baseId: string): string {
  if (!registry.userdatas.some((entry) => entry.id === baseId)) {
    return baseId;
  }
  let index = 2;
  let candidate = withNumericSuffix(baseId, index);
  while (registry.userdatas.some((entry) => entry.id === candidate)) {
    index += 1;
    candidate = withNumericSuffix(baseId, index);
  }
  return candidate;
}

function withNumericSuffix(baseId: string, index: number): string {
  const suffix = `-${index}`;
  return `${baseId.slice(0, MAX_MANAGED_ID_LENGTH - suffix.length)}${suffix}`;
}
