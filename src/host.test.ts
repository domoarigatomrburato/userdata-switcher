import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEditorHost } from "./host";

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
