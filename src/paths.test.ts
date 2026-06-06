import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEditorHost } from "./host";
import {
  resolveDefaultUserdataRoot,
  resolveManagedDataDir,
  resolveStoreRoot,
} from "./paths";

const cursor = resolveEditorHost({ appName: "Cursor", uriScheme: "cursor" });
const vscode = resolveEditorHost({
  appName: "Visual Studio Code",
  uriScheme: "vscode",
});
const insiders = resolveEditorHost({
  appName: "Visual Studio Code - Insiders",
  uriScheme: "vscode-insiders",
});
assert.ok(cursor);
assert.ok(vscode);
assert.ok(insiders);

describe("resolveStoreRoot", () => {
  it("resolves the macOS store root under a host namespace", () => {
    assert.equal(
      resolveStoreRoot(cursor, "darwin", "/Users/alice", {}),
      "/Users/alice/Library/Application Support/Userdata Switcher/Cursor",
    );
  });

  it("resolves the linux store root under a host namespace", () => {
    assert.equal(
      resolveStoreRoot(vscode, "linux", "/home/alice", {}),
      "/home/alice/.local/share/userdata-switcher/vscode",
    );
  });

  it("resolves the Windows store root under a host namespace", () => {
    assert.equal(
      resolveStoreRoot(insiders, "win32", "C:\\Users\\alice", {}),
      "C:\\Users\\alice\\AppData\\Local\\Userdata Switcher\\Visual Studio Code - Insiders",
    );
  });
});

describe("resolveDefaultUserdataRoot", () => {
  it("resolves the macOS default Cursor userdata root", () => {
    assert.equal(
      resolveDefaultUserdataRoot(cursor, "darwin", "/Users/alice", {}),
      "/Users/alice/Library/Application Support/Cursor",
    );
  });

  it("resolves the Linux default VS Code userdata root", () => {
    assert.equal(
      resolveDefaultUserdataRoot(vscode, "linux", "/home/alice", {}),
      "/home/alice/.config/Code",
    );
  });

  it("resolves the Windows default VS Code Insiders userdata root", () => {
    assert.equal(
      resolveDefaultUserdataRoot(insiders, "win32", "C:\\Users\\alice", {}),
      "C:\\Users\\alice\\AppData\\Roaming\\Code - Insiders",
    );
  });
});

describe("resolveManagedDataDir", () => {
  it("joins the store root with the registry relative path", () => {
    assert.equal(
      resolveManagedDataDir("/store", "userdata/personal/data"),
      "/store/userdata/personal/data",
    );
  });
});
