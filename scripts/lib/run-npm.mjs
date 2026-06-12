import { spawnSync } from "node:child_process";

export function runNpm(args, options = {}) {
  const result = spawnSync(npmCommand(), args, {
    stdio: "inherit",
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result;
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}
