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
      "/Users/alice/Library/Application Support/udsw/cursor",
    );
  });

  it("resolves the linux store root under a host namespace", () => {
    assert.equal(
      vscode.resolveStoreRoot({
        platform: "linux",
        home: "/home/alice",
        env: {},
      }),
      "/home/alice/.local/share/udsw/vscode",
    );
  });

  it("resolves the Windows store root under a host namespace", () => {
    assert.equal(
      insiders.resolveStoreRoot({
        platform: "win32",
        home: "C:\\Users\\alice",
        env: {},
      }),
      "C:\\Users\\alice\\AppData\\Local\\udsw\\vscode-insiders",
    );
  });

  it("keeps macOS VS Code managed socket paths below the Unix socket limit", () => {
    const storeRoot = vscode.resolveStoreRoot({
      platform: "darwin",
      home: "/Users/alessandroburato",
      env: {},
    });

    assert.ok(
      `${storeRoot}/u/1234567890123456789012/1.12-main.sock`.length < 104,
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

describe("discoverEditorCli bundled discovery", () => {
  it("finds the bundled cursor CLI under appRoot", () => {
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

  it("finds the bundled VS Code CLI under appRoot", () => {
    assert.equal(
      vscode.discoverEditorCli(
        "/Applications/Visual Studio Code.app/Contents/Resources/app",
        {
          env: { PATH: "/usr/local/bin" },
          existsSync: (candidate) => candidate.endsWith("/bin/code"),
          platform: "darwin",
        },
      ),
      "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
    );
  });

  it("prefers the bundled Windows app executable over the CLI shim", () => {
    assert.equal(
      vscode.discoverEditorCli(
        "C:\\Program Files\\Microsoft VS Code\\resources\\app",
        {
          env: { Path: "C:\\Windows\\System32" },
          existsSync: (candidate) =>
            candidate ===
              "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd" ||
            candidate === "C:\\Program Files\\Microsoft VS Code\\Code.exe",
          platform: "win32",
        },
      ),
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    );
  });

  it("finds the Windows app executable above a versioned app root", () => {
    assert.equal(
      vscode.discoverEditorCli(
        "C:\\Program Files\\Microsoft VS Code\\6928394f91\\resources\\app",
        {
          env: { Path: "C:\\Windows\\System32" },
          existsSync: (candidate) =>
            candidate === "C:\\Program Files\\Microsoft VS Code\\Code.exe",
          platform: "win32",
        },
      ),
      "C:\\Program Files\\Microsoft VS Code\\Code.exe",
    );
  });

  it("finds a bundled Windows CLI under the install root bin directory when the app executable is unavailable", () => {
    assert.equal(
      insiders.discoverEditorCli(
        "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\resources\\app",
        {
          env: { Path: "C:\\Windows\\System32" },
          existsSync: (candidate) =>
            candidate ===
            "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\bin\\code-insiders.cmd",
          platform: "win32",
        },
      ),
      "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code Insiders\\bin\\code-insiders.cmd",
    );
  });

  it("falls back to appRoot bin for Windows hosts without a resources/app root", () => {
    assert.equal(
      insiders.discoverEditorCli("C:\\Portable\\Code", {
        env: { Path: "C:\\Windows\\System32" },
        existsSync: (candidate) =>
          candidate === "C:\\Portable\\Code\\bin\\code-insiders.cmd",
        platform: "win32",
      }),
      "C:\\Portable\\Code\\bin\\code-insiders.cmd",
    );
  });

  it("falls back to the Windows app executable when the bin CLI is unavailable", () => {
    assert.equal(
      vscode.discoverEditorCli(
        "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app",
        {
          env: { Path: "C:\\Windows\\System32" },
          existsSync: (candidate) =>
            candidate ===
            "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
          platform: "win32",
        },
      ),
      "C:\\Users\\alice\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe",
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
