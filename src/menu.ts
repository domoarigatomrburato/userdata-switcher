import type { CurrentUserdata } from "./detect";
import { formatUserdataEntryLabel } from "./labels";
import type { Registry, UserdataEntry } from "./registry";

export const ACTIONS_SEPARATOR_LABEL = "Actions";
export const CREATE_USERDATA_LABEL = "$(add) Create New Userdata...";
export const RENAME_CURRENT_USERDATA_LABEL =
  "$(edit) Rename Current Userdata...";
export const REVEAL_CURRENT_USERDATA_LABEL =
  "$(folder-opened) Reveal Current Userdata...";

type MenuItemKind = "item" | "separator";
export type UserdataMenuItemIntent =
  | { kind: "create" }
  | { kind: "rename" }
  | { kind: "reveal" }
  | { kind: "open"; userdataId: string };

export type UserdataMenuIntent =
  | { kind: "cancel" }
  | { kind: "create" }
  | { kind: "rename" }
  | { kind: "reveal" }
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

  const renameItem: UserdataMenuItem = {
    intent: { kind: "rename" },
    label: RENAME_CURRENT_USERDATA_LABEL,
    alwaysShow: true,
  };
  const actionItems: UserdataMenuItem[] = [
    ...(current.kind === "known" ? [renameItem] : []),
    {
      intent: { kind: "reveal" },
      label: REVEAL_CURRENT_USERDATA_LABEL,
      alwaysShow: true,
    },
    {
      intent: { kind: "create" },
      label: CREATE_USERDATA_LABEL,
      alwaysShow: true,
    },
  ];

  return [
    ...otherUserdatas,
    { kind: "separator", label: ACTIONS_SEPARATOR_LABEL },
    ...actionItems,
  ];
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
    case "reveal":
      return intent;
    case "open": {
      const entry = registry.userdatas.find(
        (candidate) => candidate.id === intent.userdataId,
      );
      return entry ? { kind: "open", entry } : { kind: "cancel" };
    }
  }
}
