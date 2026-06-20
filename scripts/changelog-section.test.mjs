import assert from "node:assert/strict";
import test from "node:test";
import { extractChangelogSection } from "./changelog-section.mjs";

const sample = `# Changelog

## 1.3.3

### Changed

- README update.

## 1.3.2

No user-facing extension changes in this release.
`;

test("extractChangelogSection returns the matching section body", () => {
  assert.equal(
    extractChangelogSection(sample, "1.3.3"),
    "### Changed\n\n- README update.",
  );
});

test("extractChangelogSection rejects missing versions", () => {
  assert.throws(
    () => extractChangelogSection(sample, "9.9.9"),
    /No CHANGELOG.md entry/,
  );
});

test("extractChangelogSection rejects empty sections", () => {
  assert.throws(
    () =>
      extractChangelogSection("# Changelog\n\n## 1.0.0\n\n## 0.9.0\n", "1.0.0"),
    /is empty/,
  );
});
