import type { UserdataEntry } from "./registry";

export function formatUserdataLabel(entry: UserdataEntry | null): string {
  if (!entry) {
    return "Unmanaged";
  }
  if (entry.kind === "default") {
    return `${entry.label} (default)`;
  }
  return entry.label;
}

export function formatStatusBarText(entry: UserdataEntry | null): string {
  return `Userdata: ${formatUserdataLabel(entry)}`;
}
