import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pathsEqual, resolveManagedDataDir } from "../src/paths";

describe("pathsEqual", () => {
  it("compares Windows paths case-insensitively", () => {
    assert.equal(
      pathsEqual(
        "C:\\Users\\ale\\AppData\\Local\\udsw",
        "c:\\users\\ale\\appdata\\local\\udsw",
      ),
      true,
    );
  });

  it("compares POSIX paths case-sensitively", () => {
    assert.equal(pathsEqual("/store/u/work", "/store/u/work"), true);
    assert.equal(pathsEqual("/store/u/work", "/store/u/Work"), false);
  });
});

describe("resolveManagedDataDir", () => {
  it("joins the store root with the registry relative path", () => {
    assert.equal(
      resolveManagedDataDir("/store", "u/personal"),
      "/store/u/personal",
    );
  });

  it("rejects managed userdata paths outside the store root", () => {
    assert.throws(
      () => resolveManagedDataDir("/store", "../outside"),
      /Invalid managed userdata path/,
    );
    assert.throws(
      () => resolveManagedDataDir("/store", "/outside"),
      /Invalid managed userdata path/,
    );
    assert.throws(
      () => resolveManagedDataDir("/store", "external/personal"),
      /Invalid managed userdata path/,
    );
  });
});
