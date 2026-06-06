import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEditorHost } from "./host";

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

describe("resolveEditorHost", () => {
  it("resolves Cursor from the URI scheme", () => {
    const host = resolveEditorHost({
      appName: "Cursor",
      uriScheme: "cursor",
    });

    assert.equal(host?.id, "cursor");
    assert.equal(host?.displayName, "Cursor");
    assert.deepEqual(host?.cliNames, ["cursor"]);
  });

  it("resolves VS Code from the URI scheme", () => {
    const host = resolveEditorHost({
      appName: "Visual Studio Code",
      uriScheme: "vscode",
    });

    assert.equal(host?.id, "vscode");
    assert.equal(host?.displayName, "Visual Studio Code");
    assert.deepEqual(host?.cliNames, ["code"]);
  });

  it("resolves VS Code Insiders from the URI scheme", () => {
    const host = resolveEditorHost({
      appName: "Visual Studio Code - Insiders",
      uriScheme: "vscode-insiders",
    });

    assert.equal(host?.id, "vscode-insiders");
    assert.equal(host?.displayName, "Visual Studio Code - Insiders");
    assert.deepEqual(host?.cliNames, ["code-insiders"]);
  });

  it("does not guess unsupported hosts", () => {
    assert.equal(
      resolveEditorHost({
        appName: "Some VS Code Fork",
        uriScheme: "some-code-fork",
      }),
      null,
    );
  });
});

describe("resolveStoreRoot", () => {
  it("resolves the macOS store root under a host namespace", () => {
    assert.equal(
      cursor.resolveStoreRoot({
        platform: "darwin",
        home: "/Users/alice",
        env: {},
      }),
      "/Users/alice/Library/Application Support/Userdata Switcher/Cursor",
    );
  });

  it("resolves the linux store root under a host namespace", () => {
    assert.equal(
      vscode.resolveStoreRoot({
        platform: "linux",
        home: "/home/alice",
        env: {},
      }),
      "/home/alice/.local/share/userdata-switcher/vscode",
    );
  });

  it("resolves the Windows store root under a host namespace", () => {
    assert.equal(
      insiders.resolveStoreRoot({
        platform: "win32",
        home: "C:\\Users\\alice",
        env: {},
      }),
      "C:\\Users\\alice\\AppData\\Local\\Userdata Switcher\\Visual Studio Code - Insiders",
    );
  });
});

describe("resolveDefaultUserdataRoot", () => {
  it("resolves the macOS default Cursor userdata root", () => {
    assert.equal(
      cursor.resolveDefaultUserdataRoot({
        platform: "darwin",
        home: "/Users/alice",
        env: {},
      }),
      "/Users/alice/Library/Application Support/Cursor",
    );
  });

  it("resolves the Linux default VS Code userdata root", () => {
    assert.equal(
      vscode.resolveDefaultUserdataRoot({
        platform: "linux",
        home: "/home/alice",
        env: {},
      }),
      "/home/alice/.config/Code",
    );
  });

  it("resolves the Windows default VS Code Insiders userdata root", () => {
    assert.equal(
      insiders.resolveDefaultUserdataRoot({
        platform: "win32",
        home: "C:\\Users\\alice",
        env: {},
      }),
      "C:\\Users\\alice\\AppData\\Roaming\\Code - Insiders",
    );
  });
});

describe("resolveSharedExtensionsDirectory", () => {
  it("resolves the macOS Cursor shared extensions directory", () => {
    assert.equal(
      cursor.resolveSharedExtensionsDirectory({
        platform: "darwin",
        home: "/Users/alice",
        env: {},
      }),
      "/Users/alice/.cursor/extensions",
    );
  });

  it("resolves the Linux VS Code shared extensions directory", () => {
    assert.equal(
      vscode.resolveSharedExtensionsDirectory({
        platform: "linux",
        home: "/home/alice",
        env: {},
      }),
      "/home/alice/.vscode/extensions",
    );
  });

  it("resolves the Windows VS Code Insiders shared extensions directory", () => {
    assert.equal(
      insiders.resolveSharedExtensionsDirectory({
        platform: "win32",
        home: "C:\\Users\\alice",
        env: {},
      }),
      "C:\\Users\\alice\\.vscode-insiders\\extensions",
    );
  });
});

describe("discoverBundledCli", () => {
  it("finds the bundled cursor CLI under appRoot", () => {
    assert.equal(
      cursor.discoverBundledCli(
        "/Applications/Cursor.app/Contents/Resources/app",
        {
          existsSync: (candidate) => candidate.endsWith("/bin/cursor"),
          platform: "darwin",
        },
      ),
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    );
  });

  it("finds the bundled VS Code CLI under appRoot", () => {
    assert.equal(
      vscode.discoverBundledCli(
        "/Applications/Visual Studio Code.app/Contents/Resources/app",
        {
          existsSync: (candidate) => candidate.endsWith("/bin/code"),
          platform: "darwin",
        },
      ),
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    );
  });

  it("finds a bundled Windows CLI with PATHEXT", () => {
    assert.equal(
      insiders.discoverBundledCli(
        "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\resources\\app",
        {
          existsSync: (candidate) =>
            candidate.endsWith("\\bin\\code-insiders.cmd"),
          platform: "win32",
        },
      ),
      "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\resources\\app\\bin\\code-insiders.cmd",
    );
  });
});

describe("discoverEditorCli", () => {
  it("prefers the bundled editor CLI under appRoot", () => {
    assert.equal(
      cursor.discoverEditorCli(
        "/Applications/Cursor.app/Contents/Resources/app",
        {
          env: { PATH: "/usr/local/bin" },
          existsSync: (candidate) => candidate.endsWith("/bin/cursor"),
          platform: "darwin",
        },
      ),
      "/Applications/Cursor.app/Contents/Resources/app/bin/cursor",
    );
  });

  it("falls back to the host CLI on PATH when the bundled CLI is unavailable", () => {
    assert.equal(
      vscode.discoverEditorCli("/missing/Code.app/Contents/Resources/app", {
        env: { PATH: "/usr/local/bin:/opt/bin" },
        existsSync: (candidate) => candidate === "/opt/bin/code",
        platform: "darwin",
      }),
      "/opt/bin/code",
    );
  });
});
