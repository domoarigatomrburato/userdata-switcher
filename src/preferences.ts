import fs from "node:fs";
import path from "node:path";

const USER_PREFERENCE_PATHS = [
  "User/settings.json",
  "User/keybindings.json",
  "User/snippets",
] as const;

export function seedUserdataPreferences(input: {
  sourceUserdataRoot: string;
  targetUserdataRoot: string;
}): void {
  for (const relativePath of USER_PREFERENCE_PATHS) {
    copyIfPresent(
      path.join(input.sourceUserdataRoot, relativePath),
      path.join(input.targetUserdataRoot, relativePath),
    );
  }
}

function copyIfPresent(source: string, target: string): void {
  if (!fs.existsSync(source)) {
    return;
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}
