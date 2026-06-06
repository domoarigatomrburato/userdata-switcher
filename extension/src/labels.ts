import type { UserdataEntry } from "./registry";

export function formatUserdataLabel(entry: UserdataEntry | null): string {
  if (!entry) {
    return "Unmanaged";
  }
  return entry.kind === "default" ? `${entry.label} (default)` : entry.label;
}

const STATUS_BAR_ICON = "$(layers)";

export function formatStatusBarText(entry: UserdataEntry | null): string {
  return `${STATUS_BAR_ICON} Userdata: ${formatUserdataLabel(entry)}`;
}

export function formatCurrentUserdataMenuHeader(entry: UserdataEntry | null): string {
  return `Current: ${formatUserdataLabel(entry)}`;
}

export function formatOpenWithUserdataPickerTitle(entry: UserdataEntry | null): string {
  return `Open With Userdata — ${formatCurrentUserdataMenuHeader(entry)}`;
}
