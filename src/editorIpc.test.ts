import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listMainSocketPaths,
  mainSocketBasenameForEditorVersion,
  mainSocketPath,
  probeRunningUserdataInstance,
} from "./editorIpc";

describe("mainSocketBasenameForEditorVersion", () => {
  it("matches VS Code socket naming for API versions", () => {
    assert.equal(
      mainSocketBasenameForEditorVersion("1.105.1"),
      "1.10-main.sock",
    );
  });

  it("matches Cursor product socket naming", () => {
    assert.equal(
      mainSocketBasenameForEditorVersion("3.7.42"),
      "3.7.-main.sock",
    );
  });
});

describe("listMainSocketPaths", () => {
  it("discovers versioned main sockets in the userdata root", () => {
    assert.deepEqual(
      listMainSocketPaths("/store/u/personal", "1.105.1", () => [
        "Cache",
        "3.7.-main.sock",
      ]),
      ["/store/u/personal/1.10-main.sock", "/store/u/personal/3.7.-main.sock"],
    );
  });
});

describe("mainSocketPath", () => {
  it("joins the editor-version socket basename under the userdata root", () => {
    assert.equal(
      mainSocketPath("/store/u/personal", "1.105.1"),
      "/store/u/personal/1.10-main.sock",
    );
  });
});

describe("probeRunningUserdataInstance", () => {
  it("reports running when any discovered IPC socket accepts a connection", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "linux",
      editorVersion: "1.105.1",
      readdirSync: () => ["3.7.-main.sock"],
      connect: async (socketPath) =>
        socketPath.endsWith("3.7.-main.sock") ? "connected" : "missing",
    });

    assert.equal(result, "running");
  });

  it("reports not running when the IPC socket file is missing", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "darwin",
      readdirSync: () => [],
      connect: async () => "missing",
    });

    assert.equal(result, "not-running");
  });

  it("reports not running when the IPC socket is stale", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "linux",
      readdirSync: () => ["3.7.-main.sock"],
      connect: async () => "refused",
    });

    assert.equal(result, "not-running");
  });

  it("treats a hung IPC connection attempt as not running", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "linux",
      readdirSync: () => ["1.10-main.sock"],
      connectTimeoutMs: 25,
      connect: () => new Promise(() => {}),
    });

    assert.equal(result, "not-running");
  });

  it("skips Unix socket connect on Windows", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "win32",
      connect: async () => {
        throw new Error("connect should not run on win32");
      },
    });

    assert.equal(result, "not-running");
  });
});
