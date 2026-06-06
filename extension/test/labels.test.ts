import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStatusBarText, formatUserdataLabel } from "../src/labels";

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

describe("formatStatusBarText", () => {
  it("prefixes the compact UI label", () => {
    assert.equal(
      formatStatusBarText({ id: "default", kind: "default", label: "Work" }),
      "Userdata: Work (default)",
    );
  });
});
