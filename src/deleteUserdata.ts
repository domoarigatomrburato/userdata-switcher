import type { CurrentUserdata } from "./detect";
import type { Registry, UserdataEntry } from "./registry";

export const DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE =
  "You can't delete the userdata this window is using. Open or switch to another userdata window, then delete it from there.";

export const DELETE_NO_MANAGED_MESSAGE = "No managed userdatas to delete.";

export const DELETE_IN_USE_MESSAGE =
  "Close all windows using this userdata, then try deleting again.";

export const DELETE_TRASH_FAILURE_MESSAGE =
  "Could not delete userdata folder. It might be open in another window. Please close all windows using this userdata and try again.";

export function listDeletableManagedUserdatas(
  registry: Registry,
  current: CurrentUserdata,
): UserdataEntry[] {
  return registry.userdatas.filter(
    (entry) =>
      entry.kind === "managed" &&
      (current.kind === "unmanaged" || entry.id !== current.entry.id),
  );
}

export function describeDeleteUserdataBlockedReason(
  registry: Registry,
  current: CurrentUserdata,
): string | null {
  if (listDeletableManagedUserdatas(registry, current).length > 0) {
    return null;
  }

  const managedCount = registry.userdatas.filter(
    (entry) => entry.kind === "managed",
  ).length;
  if (
    managedCount > 0 &&
    current.kind === "known" &&
    current.entry.kind === "managed"
  ) {
    return DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE;
  }

  return DELETE_NO_MANAGED_MESSAGE;
}
