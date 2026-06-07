import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveManagedDataDir } from "./paths";

describe("resolveManagedDataDir", () => {
  it("joins the store root with the registry relative path", () => {
    assert.equal(
      resolveManagedDataDir("/store", "u/personal"),
      "/store/u/personal",
    );
  });
});
