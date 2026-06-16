import fs from "node:fs";
import path from "node:path";

type UserdataKind = "default" | "managed";

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
  return planManagedUserdataCreation(registry, label).registry;
}

export function planManagedUserdataCreation(
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

export function removeUserdata(registry: Registry, entryId: string): Registry {
  return {
    version: 1,
    userdatas: registry.userdatas.filter((entry) => entry.id !== entryId),
  };
}

const NON_ALPHANUMERIC_REGEX = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHENS_REGEX = /^-+|-+$/g;
const TRAILING_HYPHENS_REGEX = /-+$/g;

function slugifyLabel(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_REGEX, "-")
    .replace(LEADING_TRAILING_HYPHENS_REGEX, "")
    .slice(0, MAX_MANAGED_ID_LENGTH)
    .replace(TRAILING_HYPHENS_REGEX, "");
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
