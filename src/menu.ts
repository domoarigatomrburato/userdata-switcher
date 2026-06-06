import { formatUserdataLabel } from "./labels";
import type { Registry, UserdataEntry } from "./registry";

export const CREATE_USERDATA_LABEL = "Create New Userdata...";
export const RENAME_CURRENT_USERDATA_LABEL = "Rename Current Userdata...";

export type MenuItemKind = "item" | "separator";

export interface UserdataMenuItem {
  action?: "create" | "rename";
  label: string;
  description?: string;
  kind?: MenuItemKind;
  userdataId?: string;
  alwaysShow?: boolean;
}

export function buildOpenWithUserdataMenuItems(
  registry: Registry,
  current: UserdataEntry | null,
  createUserdataLabel: string = CREATE_USERDATA_LABEL,
  renameCurrentUserdataLabel: string = RENAME_CURRENT_USERDATA_LABEL,
): UserdataMenuItem[] {
  const otherUserdatas = registry.userdatas
    .filter((entry) => entry.id !== current?.id)
    .map((entry) => ({
      label: formatUserdataLabel(entry),
      description:
        entry.kind === "default" ? "Default Userdata" : "Managed Userdata",
      userdataId: entry.id,
    }));

  const items: UserdataMenuItem[] = [...otherUserdatas];

  if (otherUserdatas.length > 0) {
    items.push({ kind: "separator", label: "" });
  }

  if (current) {
    items.push({
      action: "rename",
      label: renameCurrentUserdataLabel,
      alwaysShow: true,
    });
  }
  items.push({
    action: "create",
    label: createUserdataLabel,
    alwaysShow: true,
  });

  return items;
}
