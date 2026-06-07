import type { CurrentUserdata } from "./detect";
import type { UserdataEntry } from "./registry";

export function formatUserdataEntryLabel(entry: UserdataEntry): string {
  return entry.kind === "default" ? `${entry.label} (default)` : entry.label;
}

export function formatUserdataLabel(current: CurrentUserdata): string {
  if (current.kind === "unmanaged") {
    return "Unmanaged";
  }
  return formatUserdataEntryLabel(current.entry);
}

const STATUS_BAR_ICON = "$(layers)";

export function formatStatusBarText(current: CurrentUserdata): string {
  return `${STATUS_BAR_ICON} ${formatUserdataLabel(current)}`;
}

export function formatOpenWithUserdataPickerTitle(
  current: CurrentUserdata,
): string {
  return `Open With Userdata — Current: ${formatUserdataLabel(current)}`;
}
