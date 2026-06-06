import fs from "node:fs";
import path from "node:path";

export type UserdataKind = "default" | "managed";

export interface UserdataEntry {
  id: string;
  kind: UserdataKind;
  label: string;
  relativeDataDir?: string;
}

export interface Registry {
  version: 1;
  userdatas: UserdataEntry[];
}

const DEFAULT_ENTRY: UserdataEntry = {
  id: "default",
  kind: "default",
  label: "Default",
};

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
  const latest = ensureDefaultUserdata(loadRegistry(registryFile));
  const updated = update(latest);
  saveRegistry(registryFile, updated);
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
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Userdata label is required");
  }
  const id = createUniqueId(registry, slugifyLabel(trimmed));
  const entry: UserdataEntry = {
    id,
    kind: "managed",
    label: trimmed,
    relativeDataDir: `userdata/${id}/data`,
  };
  return {
    version: 1,
    userdatas: [...registry.userdatas, entry],
  };
}

export function renameUserdata(
  registry: Registry,
  entryId: string,
  label: string,
): Registry {
  const trimmed = label.trim();
  if (!trimmed) {
    throw new Error("Userdata label is required");
  }
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
    .replace(/^-+|-+$/g, "");
  return slug || "userdata";
}

function createUniqueId(registry: Registry, baseId: string): string {
  if (!registry.userdatas.some((entry) => entry.id === baseId)) {
    return baseId;
  }
  let index = 2;
  while (
    registry.userdatas.some((entry) => entry.id === `${baseId}-${index}`)
  ) {
    index += 1;
  }
  return `${baseId}-${index}`;
}
