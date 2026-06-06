import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDefaultUserdataRoot,
  resolveManagedDataDir,
  resolveStoreRoot,
} from "../src/paths";

describe("resolveStoreRoot", () => {
  it("resolves the macOS store root", () => {
    assert.equal(
      resolveStoreRoot("darwin", "/Users/alice"),
      "/Users/alice/Library/Application Support/Cursor Userdata Switcher",
    );
  });

  it("resolves the linux store root", () => {
    assert.equal(
      resolveStoreRoot("linux", "/home/alice"),
      "/home/alice/.local/share/cursor-userdata-switcher",
    );
  });
});

describe("resolveDefaultUserdataRoot", () => {
  it("resolves the macOS default Cursor userdata root", () => {
    assert.equal(
      resolveDefaultUserdataRoot("darwin", "/Users/alice"),
      "/Users/alice/Library/Application Support/Cursor",
    );
  });
});

describe("resolveManagedDataDir", () => {
  it("joins the store root with the registry relative path", () => {
    assert.equal(
      resolveManagedDataDir(
        "/store",
        "userdata/personal/data",
      ),
      "/store/userdata/personal/data",
    );
  });
});
