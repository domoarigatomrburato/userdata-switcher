import { isDeletableManagedUserdata } from "./deleteUserdata";
import type { CurrentUserdata } from "./detect";
import {
  formatCurrentWindowHeaderLabel,
  formatUserdataEntryLabel,
  formatUserdataLabel,
} from "./labels";
import type { Registry, UserdataEntry } from "./registry";

export const OPEN_USERDATA_IN_NEW_WINDOW_TITLE = "Open Userdata in New Window";
export const OPEN_USERDATA_IN_NEW_WINDOW_PLACEHOLDER =
  "Select a userdata to open in a new window";
export const MANAGE_USERDATAS_TITLE = "Manage Userdatas";
export const MANAGE_USERDATAS_PLACEHOLDER = "Select a userdata to manage";
export const CREATE_USERDATA_LABEL = "$(add) Create new userdata...";
export const MANAGE_USERDATAS_LABEL = "$(gear) Manage userdatas...";
export const RENAME_USERDATA_LABEL = "$(edit) Rename...";
export const REVEAL_USERDATA_LABEL = "$(folder-opened) Reveal...";
export const DELETE_USERDATA_LABEL = "$(trash) Delete userdata...";
export const DELETE_USERDATA_TITLE = "Delete Userdata";
export const DELETE_USERDATA_PLACEHOLDER = "Select a userdata to delete";

export type UserdataRunningState = "running" | "idle";

const FOOTER_SEPARATOR: UserdataMenuItem = { kind: "separator", label: "" };
export type UserdataMenuItemIntent =
  | { kind: "create" }
  | { kind: "manage" }
  | { kind: "managePick"; userdataId: string }
  | { kind: "rename"; userdataId: string }
  | { kind: "reveal"; userdataId: string }
  | { kind: "delete"; userdataId: string }
  | { kind: "open"; userdataId: string };

export type UserdataMenuIntent =
  | { kind: "cancel" }
  | { kind: "create" }
  | { kind: "manage" }
  | { kind: "managePick"; entry: UserdataEntry }
  | { kind: "rename"; entry: UserdataEntry }
  | { kind: "reveal"; entry: UserdataEntry }
  | { kind: "delete"; entry: UserdataEntry }
  | { kind: "open"; entry: UserdataEntry };

export interface UserdataMenuSelection {
  intent?: UserdataMenuItemIntent;
}

export interface UserdataMenuItem extends UserdataMenuSelection {
  label: string;
  description?: string;
  kind?: "item" | "separator";
  alwaysShow?: boolean;
}

export function buildOpenInNewWindowMenuItems(
  registry: Registry,
  current: CurrentUserdata,
  runningByUserdataId: ReadonlyMap<string, UserdataRunningState>,
): UserdataMenuItem[] {
  const header: UserdataMenuItem = {
    kind: "separator",
    label: formatCurrentWindowHeaderLabel(current),
  };

  const launchTargets: UserdataMenuItem[] = registry.userdatas
    .filter(
      (entry) => current.kind === "unmanaged" || entry.id !== current.entry.id,
    )
    .map((entry) => ({
      label: formatUserdataEntryLabel(entry),
      description: runningByUserdataId.get(entry.id) ?? "idle",
      intent: { kind: "open", userdataId: entry.id },
    }));

  const footerItems: UserdataMenuItem[] = [
    {
      intent: { kind: "create" },
      label: CREATE_USERDATA_LABEL,
      alwaysShow: true,
    },
    {
      intent: { kind: "manage" },
      label: MANAGE_USERDATAS_LABEL,
      alwaysShow: true,
    },
  ];

  return [header, ...launchTargets, FOOTER_SEPARATOR, ...footerItems];
}

export function buildDeleteUserdataMenuItems(
  deletable: UserdataEntry[],
): UserdataMenuItem[] {
  return deletable.map((entry) => ({
    label: formatUserdataLabel({ kind: "known", entry }),
    description: entry.relativeDataDir,
    intent: { kind: "delete", userdataId: entry.id },
  }));
}

export function buildManageUserdatasMenuItems(
  registry: Registry,
): UserdataMenuItem[] {
  return registry.userdatas.map((entry) => ({
    label: formatUserdataEntryLabel(entry),
    description:
      entry.kind === "default" ? "Default Userdata" : "Managed Userdata",
    intent: { kind: "managePick", userdataId: entry.id },
  }));
}

export function buildManageUserdataActionMenuItems(
  entry: UserdataEntry,
  current: CurrentUserdata,
): UserdataMenuItem[] {
  const items: UserdataMenuItem[] = [
    {
      intent: { kind: "reveal", userdataId: entry.id },
      label: REVEAL_USERDATA_LABEL,
      alwaysShow: true,
    },
    {
      intent: { kind: "rename", userdataId: entry.id },
      label: RENAME_USERDATA_LABEL,
      alwaysShow: true,
    },
  ];

  if (isDeletableManagedUserdata(entry, current)) {
    items.push(FOOTER_SEPARATOR, {
      intent: { kind: "delete", userdataId: entry.id },
      label: DELETE_USERDATA_LABEL,
      alwaysShow: true,
    });
  }

  return items;
}

export function resolveUserdataMenuIntent(
  registry: Registry,
  selection: UserdataMenuSelection | undefined,
): UserdataMenuIntent {
  const intent = selection?.intent;
  if (!intent) {
    return { kind: "cancel" };
  }
  if (intent.kind === "create" || intent.kind === "manage") {
    return intent;
  }

  const entry = registry.userdatas.find(
    (candidate) => candidate.id === intent.userdataId,
  );
  if (!entry) {
    return { kind: "cancel" };
  }
  return { kind: intent.kind, entry };
}
