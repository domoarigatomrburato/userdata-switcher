import type { Registry } from "../src/registry";

export function defaultAndPersonalRegistry(
  labels: { default?: string; personal?: string } = {},
): Registry {
  return {
    version: 1,
    userdatas: [
      { id: "default", kind: "default", label: labels.default ?? "Default" },
      {
        id: "personal",
        kind: "managed",
        label: labels.personal ?? "Personal",
        relativeDataDir: "u/personal",
      },
    ],
  };
}

export function defaultOnlyRegistry(defaultLabel = "Default"): Registry {
  return {
    version: 1,
    userdatas: [{ id: "default", kind: "default", label: defaultLabel }],
  };
}

export function workAndPersonalRegistry(): Registry {
  return {
    version: 1,
    userdatas: [
      { id: "default", kind: "default", label: "Default" },
      {
        id: "work",
        kind: "managed",
        label: "Work",
        relativeDataDir: "u/work",
      },
      {
        id: "personal",
        kind: "managed",
        label: "Personal",
        relativeDataDir: "u/personal",
      },
    ],
  };
}
