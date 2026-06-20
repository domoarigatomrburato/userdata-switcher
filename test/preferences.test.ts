import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { seedUserdataPreferences } from "../src/preferences";

describe("seedUserdataPreferences", () => {
  let tmpDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "userdata-switcher-test-"));
    sourceDir = path.join(tmpDir, "source");
    targetDir = path.join(tmpDir, "target");
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(targetDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("copies expected files and directories when they exist", () => {
    // Create source files
    const settingsPath = path.join(sourceDir, "User", "settings.json");
    const keybindingsPath = path.join(sourceDir, "User", "keybindings.json");
    const snippetsDir = path.join(sourceDir, "User", "snippets");
    const snippetFile = path.join(snippetsDir, "javascript.json");

    fs.mkdirSync(path.join(sourceDir, "User"), { recursive: true });
    fs.mkdirSync(snippetsDir, { recursive: true });

    fs.writeFileSync(settingsPath, '{"editor.formatOnSave": true}');
    fs.writeFileSync(keybindingsPath, '[{"key": "cmd+s"}]');
    fs.writeFileSync(snippetFile, '{"console.log": {}}');

    seedUserdataPreferences({
      sourceUserdataRoot: sourceDir,
      targetUserdataRoot: targetDir,
    });

    // Assert files were copied to target
    assert.equal(
      fs.readFileSync(path.join(targetDir, "User", "settings.json"), "utf8"),
      '{"editor.formatOnSave": true}',
    );
    assert.equal(
      fs.readFileSync(path.join(targetDir, "User", "keybindings.json"), "utf8"),
      '[{"key": "cmd+s"}]',
    );
    assert.equal(
      fs.readFileSync(
        path.join(targetDir, "User", "snippets", "javascript.json"),
        "utf8",
      ),
      '{"console.log": {}}',
    );
  });

  it("skips paths that do not exist in the source directory", () => {
    // Only create settings.json
    const settingsPath = path.join(sourceDir, "User", "settings.json");
    fs.mkdirSync(path.join(sourceDir, "User"), { recursive: true });
    fs.writeFileSync(settingsPath, '{"editor.formatOnSave": true}');

    seedUserdataPreferences({
      sourceUserdataRoot: sourceDir,
      targetUserdataRoot: targetDir,
    });

    // Assert only settings.json was copied
    assert.equal(
      fs.readFileSync(path.join(targetDir, "User", "settings.json"), "utf8"),
      '{"editor.formatOnSave": true}',
    );

    // Assert other files/directories do not exist
    assert.equal(
      fs.existsSync(path.join(targetDir, "User", "keybindings.json")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, "User", "snippets")),
      false,
    );
  });

  it("does nothing when the source directory is completely empty", () => {
    seedUserdataPreferences({
      sourceUserdataRoot: sourceDir,
      targetUserdataRoot: targetDir,
    });

    // Assert no User directory was created
    assert.equal(fs.existsSync(path.join(targetDir, "User")), false);
  });
});
