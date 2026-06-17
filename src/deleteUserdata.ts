import type { CurrentUserdata } from "./detect";
import type { Registry, UserdataEntry } from "./registry";

export const DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE =
  "You can't delete the userdata this window is using. Open or switch to another userdata window, then delete it from there.";

export const DELETE_NO_MANAGED_MESSAGE = "No managed userdatas to delete.";

export const DELETE_QUIT_AND_DELETE_LABEL = "Quit and delete";

export const DELETE_QUIT_FAILED_MESSAGE =
  "Could not quit the editor instance for this userdata. Quit it manually from its menu bar icon (Cmd+Q on macOS), then try again.";

export const DELETE_TRASH_FAILURE_MESSAGE =
  "Could not delete the userdata folder. Quit any running instance for it, then try again.";

export const DELETE_VERIFY_PATH_STILL_EXISTS_MESSAGE =
  "The userdata folder could not be removed. Quit any running instance for it, then try again.";

export const DELETE_VERIFY_INSTANCE_STILL_RUNNING_MESSAGE =
  "The editor instance for this userdata is still running after deletion was attempted. Quit it manually, then try again.";

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
