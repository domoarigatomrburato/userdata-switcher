import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mainSocketPath,
  probeRunningUserdataInstance,
  VSCODE_MAIN_SOCKET_BASENAME,
} from "./editorIpc";

describe("mainSocketPath", () => {
  it("joins the VS Code main IPC socket basename under the userdata root", () => {
    assert.equal(
      mainSocketPath("/store/u/personal"),
      `/store/u/personal/${VSCODE_MAIN_SOCKET_BASENAME}`,
    );
  });
});

describe("probeRunningUserdataInstance", () => {
  it("reports running when the IPC socket accepts a connection", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "linux",
      connect: async () => "connected",
    });

    assert.equal(result, "running");
  });

  it("reports not running when the IPC socket file is missing", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "darwin",
      connect: async () => "missing",
    });

    assert.equal(result, "not-running");
  });

  it("reports not running when the IPC socket is stale", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "linux",
      connect: async () => "refused",
    });

    assert.equal(result, "not-running");
  });

  it("skips the IPC probe on Windows and relies on delete failure instead", async () => {
    const result = await probeRunningUserdataInstance("/store/u/personal", {
      platform: "win32",
      connect: async () => {
        throw new Error("connect should not run on win32");
      },
    });

    assert.equal(result, "not-running");
  });
});
