import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCurrentUserdataMenuHeader,
  formatOpenWithUserdataPickerTitle,
  formatStatusBarText,
  formatUserdataLabel,
} from "../src/labels";

describe("formatUserdataLabel", () => {
  it("shows default userdata with the default suffix", () => {
    assert.equal(
      formatUserdataLabel({ id: "default", kind: "default", label: "Work" }),
      "Work (default)",
    );
  });

  it("shows managed userdata without a suffix", () => {
    assert.equal(
      formatUserdataLabel({
        id: "personal",
        kind: "managed",
        label: "Personal",
        relativeDataDir: "userdata/personal/data",
      }),
      "Personal",
    );
  });

  it("shows unmanaged userdata", () => {
    assert.equal(formatUserdataLabel(null), "Unmanaged");
  });
});

describe("formatCurrentUserdataMenuHeader", () => {
  it("labels the non-actionable current userdata header", () => {
    assert.equal(
      formatCurrentUserdataMenuHeader({ id: "default", kind: "default", label: "Work" }),
      "Current: Work (default)",
    );
  });
});

describe("formatOpenWithUserdataPickerTitle", () => {
  it("shows the current userdata in the picker title", () => {
    assert.equal(
      formatOpenWithUserdataPickerTitle({ id: "default", kind: "default", label: "Default" }),
      "Open With Userdata — Current: Default (default)",
    );
  });
});

describe("formatStatusBarText", () => {
  it("prefixes the compact UI label", () => {
    assert.equal(
      formatStatusBarText({ id: "default", kind: "default", label: "Work" }),
      "$(layers) Userdata: Work (default)",
    );
  });
});
