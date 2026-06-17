import { DELETE_QUIT_AND_DELETE_LABEL } from "./deleteUserdata";
import { listMainSocketPaths } from "./editorIpc";

export type ManagedUserdataDeletionOutcome =
  | { status: "cancelled" }
  | { status: "success" }
  | { status: "quit-failed" }
  | { status: "delete-failed" }
  | {
      status: "verify-failed";
      reason: "path-still-exists" | "instance-still-running";
    };

export interface ManagedUserdataDeletionDeps {
  targetPath: string;
  label: string;
  editorVersion?: string;
  isManagedUserdataInUse: (managedUserdataRoot: string) => Promise<boolean>;
  quitManagedUserdataInstance: (
    managedUserdataRoot: string,
  ) => Promise<boolean>;
  deletePath: (managedUserdataRoot: string) => Promise<void>;
  pathExists: (managedUserdataRoot: string) => boolean;
  confirmDeletion: (message: string, confirmLabel: string) => Promise<boolean>;
  logInfo?: (message: string) => void;
  logError?: (message: string) => void;
}

export function buildDeleteUserdataConfirmation(
  label: string,
  instanceRunning: boolean,
): { message: string; confirmLabel: string } {
  const trashNote = "Its settings and data files will be moved to the trash.";

  if (instanceRunning) {
    return {
      message: `Delete userdata "${label}"? An editor instance for it is still running — closing its window is not enough. Quit and delete will quit that instance first, then delete the files. ${trashNote}`,
      confirmLabel: DELETE_QUIT_AND_DELETE_LABEL,
    };
  }

  return {
    message: `Delete userdata "${label}"? ${trashNote}`,
    confirmLabel: "Delete",
  };
}

export async function executeManagedUserdataDeletion(
  deps: ManagedUserdataDeletionDeps,
): Promise<ManagedUserdataDeletionOutcome> {
  const logInfo = deps.logInfo ?? (() => {});
  const logError = deps.logError ?? (() => {});

  const socketCandidates = listMainSocketPaths(
    deps.targetPath,
    deps.editorVersion,
  );
  logInfo(
    `Delete preflight socket candidates: ${
      socketCandidates.length > 0 ? socketCandidates.join(", ") : "(none)"
    }`,
  );

  const instanceRunning = await deps.isManagedUserdataInUse(deps.targetPath);
  const { message, confirmLabel } = buildDeleteUserdataConfirmation(
    deps.label,
    instanceRunning,
  );

  if (!(await deps.confirmDeletion(message, confirmLabel))) {
    return { status: "cancelled" };
  }

  if (!(await ensureUserdataInstanceStopped(deps, logInfo))) {
    return { status: "quit-failed" };
  }

  if (await deps.isManagedUserdataInUse(deps.targetPath)) {
    logInfo(
      `Delete blocked: editor instance for ${deps.targetPath} is still running before trash`,
    );
    return { status: "quit-failed" };
  }

  try {
    await deps.deletePath(deps.targetPath);
  } catch (error) {
    logError(error instanceof Error ? error.message : String(error));
    return { status: "delete-failed" };
  }

  if (deps.pathExists(deps.targetPath)) {
    return { status: "verify-failed", reason: "path-still-exists" };
  }

  if (await deps.isManagedUserdataInUse(deps.targetPath)) {
    return { status: "verify-failed", reason: "instance-still-running" };
  }

  return { status: "success" };
}

async function ensureUserdataInstanceStopped(
  deps: Pick<
    ManagedUserdataDeletionDeps,
    "targetPath" | "isManagedUserdataInUse" | "quitManagedUserdataInstance"
  >,
  logInfo: (message: string) => void,
): Promise<boolean> {
  if (!(await deps.isManagedUserdataInUse(deps.targetPath))) {
    return true;
  }

  logInfo(
    `Attempting to quit editor instance for userdata at ${deps.targetPath}`,
  );
  const quit = await deps.quitManagedUserdataInstance(deps.targetPath);
  if (!quit) {
    return false;
  }

  if (await deps.isManagedUserdataInUse(deps.targetPath)) {
    return false;
  }

  logInfo(`Editor instance quit successfully for ${deps.targetPath}`);
  return true;
}
