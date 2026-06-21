import type { CurrentUserdata } from "./detect";
import type { Registry, UserdataEntry } from "./registry";

export const DELETE_BLOCKED_CURRENT_WINDOW_MESSAGE =
  "You can't delete the userdata this window is using. Open or switch to another userdata window, then delete it from there.";

export const DELETE_NO_MANAGED_MESSAGE = "No managed userdatas to delete.";

export const DELETE_QUIT_AND_DELETE_LABEL = "Quit and delete";

const DELETE_QUIT_RUNNING_INSTANCE_INSTRUCTION =
  "Quit any running instance for it, then try again.";

export const DELETE_QUIT_FAILED_MESSAGE =
  "Could not quit the editor instance for this userdata. Quit that editor instance manually, then try again.";

export const DELETE_TRASH_FAILURE_MESSAGE = `Could not delete the userdata folder. ${DELETE_QUIT_RUNNING_INSTANCE_INSTRUCTION}`;

export const DELETE_VERIFY_PATH_STILL_EXISTS_MESSAGE = `The userdata folder could not be removed. ${DELETE_QUIT_RUNNING_INSTANCE_INSTRUCTION}`;

export const DELETE_VERIFY_INSTANCE_STILL_RUNNING_MESSAGE =
  "The editor instance for this userdata is still running after deletion was attempted. Quit it manually, then try again.";

export function isDeletableManagedUserdata(
  entry: UserdataEntry,
  current: CurrentUserdata,
): boolean {
  return (
    entry.kind === "managed" &&
    (current.kind === "unmanaged" || entry.id !== current.entry.id)
  );
}

export function listDeletableManagedUserdatas(
  registry: Registry,
  current: CurrentUserdata,
): UserdataEntry[] {
  return registry.userdatas.filter((entry) =>
    isDeletableManagedUserdata(entry, current),
  );
}

export function describeDeleteUserdataBlockedReason(
  registry: Registry,
  current: CurrentUserdata,
  deletable: UserdataEntry[] = listDeletableManagedUserdatas(registry, current),
): string | null {
  if (deletable.length > 0) {
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
