import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatOpenWithUserdataPickerTitle,
  formatStatusBarText,
  formatUserdataLabel,
} from "./labels";

describe("formatUserdataLabel", () => {
  it("shows known default userdata with the default suffix", () => {
    assert.equal(
      formatUserdataLabel({
        kind: "known",
        entry: { id: "default", kind: "default", label: "Work" },
      }),
      "Work (default)",
    );
  });

  it("shows known managed userdata without a suffix", () => {
    assert.equal(
      formatUserdataLabel({
        kind: "known",
        entry: {
          id: "personal",
          kind: "managed",
          label: "Personal",
          relativeDataDir: "u/personal",
        },
      }),
      "Personal",
    );
  });

  it("shows unmanaged userdata", () => {
    assert.equal(formatUserdataLabel({ kind: "unmanaged" }), "Unmanaged");
  });
});

describe("formatOpenWithUserdataPickerTitle", () => {
  it("shows the current userdata in the picker title", () => {
    assert.equal(
      formatOpenWithUserdataPickerTitle({
        kind: "known",
        entry: {
          id: "default",
          kind: "default",
          label: "Default",
        },
      }),
      "Current: Default (default)",
    );
  });
});

describe("formatStatusBarText", () => {
  it("prefixes the compact UI label", () => {
    assert.equal(
      formatStatusBarText({
        kind: "known",
        entry: { id: "default", kind: "default", label: "Work" },
      }),
      "$(layers) Work (default)",
    );
  });
});
