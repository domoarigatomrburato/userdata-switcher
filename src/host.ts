export type EditorHostId = "cursor" | "vscode" | "vscode-insiders";

export interface EditorHost {
  id: EditorHostId;
  displayName: string;
  storageName: string;
  storageSlug: string;
  defaultUserdataDirName: string;
  cliNames: string[];
}

export interface EditorHostIdentity {
  appName: string;
  uriScheme: string;
}

const HOSTS: EditorHost[] = [
  {
    id: "cursor",
    displayName: "Cursor",
    storageName: "Cursor",
    storageSlug: "cursor",
    defaultUserdataDirName: "Cursor",
    cliNames: ["cursor"],
  },
  {
    id: "vscode",
    displayName: "Visual Studio Code",
    storageName: "Visual Studio Code",
    storageSlug: "vscode",
    defaultUserdataDirName: "Code",
    cliNames: ["code"],
  },
  {
    id: "vscode-insiders",
    displayName: "Visual Studio Code - Insiders",
    storageName: "Visual Studio Code - Insiders",
    storageSlug: "vscode-insiders",
    defaultUserdataDirName: "Code - Insiders",
    cliNames: ["code-insiders"],
  },
];

export function resolveEditorHost(
  identity: EditorHostIdentity,
): EditorHost | null {
  return (
    HOSTS.find((host) => host.id === identity.uriScheme) ??
    HOSTS.find((host) => host.displayName === identity.appName) ??
    null
  );
}
