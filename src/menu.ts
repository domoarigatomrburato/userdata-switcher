import type { CurrentUserdata } from "./detect";
import { formatUserdataEntryLabel } from "./labels";
import type { Registry, UserdataEntry } from "./registry";

export const CREATE_USERDATA_LABEL = "Create New Userdata...";
export const RENAME_CURRENT_USERDATA_LABEL = "Rename Current Userdata...";

export type MenuItemKind = "item" | "separator";
export type UserdataMenuItemIntent =
  | { kind: "create" }
  | { kind: "rename" }
  | { kind: "open"; userdataId: string };

export type UserdataMenuIntent =
  | { kind: "cancel" }
  | { kind: "create" }
  | { kind: "rename" }
  | { kind: "open"; entry: UserdataEntry };

export interface UserdataMenuSelection {
  intent?: UserdataMenuItemIntent;
}

export interface UserdataMenuItem extends UserdataMenuSelection {
  label: string;
  description?: string;
  kind?: MenuItemKind;
  alwaysShow?: boolean;
}

export function buildOpenWithUserdataMenuItems(
  registry: Registry,
  current: CurrentUserdata,
  createUserdataLabel: string = CREATE_USERDATA_LABEL,
  renameCurrentUserdataLabel: string = RENAME_CURRENT_USERDATA_LABEL,
): UserdataMenuItem[] {
  const otherUserdatas: UserdataMenuItem[] = registry.userdatas
    .filter(
      (entry) => current.kind === "unmanaged" || entry.id !== current.entry.id,
    )
    .map((entry) => ({
      label: formatUserdataEntryLabel(entry),
      description:
        entry.kind === "default" ? "Default Userdata" : "Managed Userdata",
      intent: { kind: "open", userdataId: entry.id },
    }));

  const items: UserdataMenuItem[] = [...otherUserdatas];

  if (otherUserdatas.length > 0) {
    items.push({ kind: "separator", label: "" });
  }

  if (current.kind === "known") {
    items.push({
      intent: { kind: "rename" },
      label: renameCurrentUserdataLabel,
      alwaysShow: true,
    });
  }
  items.push({
    intent: { kind: "create" },
    label: createUserdataLabel,
    alwaysShow: true,
  });

  return items;
}

export function resolveOpenWithUserdataMenuIntent(
  registry: Registry,
  selection: UserdataMenuSelection | undefined,
): UserdataMenuIntent {
  const intent = selection?.intent;
  if (!intent) {
    return { kind: "cancel" };
  }

  switch (intent.kind) {
    case "create":
    case "rename":
      return intent;
    case "open": {
      const entry = registry.userdatas.find(
        (candidate) => candidate.id === intent.userdataId,
      );
      return entry ? { kind: "open", entry } : { kind: "cancel" };
    }
  }
}
