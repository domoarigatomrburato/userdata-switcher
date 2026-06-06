import { formatUserdataLabel } from "./labels";
import type { Registry, UserdataEntry } from "./registry";

export type MenuItemKind = "item" | "separator";

export interface UserdataMenuItem {
  label: string;
  description?: string;
  kind?: MenuItemKind;
  userdataId?: string;
  alwaysShow?: boolean;
}

export function buildOpenWithUserdataMenuItems(
  registry: Registry,
  current: UserdataEntry | null,
  createUserdataLabel: string,
): UserdataMenuItem[] {
  const otherUserdatas = registry.userdatas
    .filter((entry) => entry.id !== current?.id)
    .map((entry) => ({
      label: formatUserdataLabel(entry),
      description: entry.kind === "default" ? "Default Userdata" : "Managed Userdata",
      userdataId: entry.id,
    }));

  const items: UserdataMenuItem[] = [...otherUserdatas];

  if (otherUserdatas.length > 0) {
    items.push({ kind: "separator", label: "" });
  }

  items.push({
    label: createUserdataLabel,
    alwaysShow: true,
  });

  return items;
}
