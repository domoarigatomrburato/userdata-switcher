# Contributing

Thanks for helping improve Userdata Switcher.

## Prerequisites

- Node.js 22 or newer
- npm

## Local Setup

```bash
npm ci
```

## Common Commands

```bash
npm run check
npm test
npm run build
npm run package:vsix
```

`npm run check` is the default formatting and linting command for this repo.

## Documentation Split

- `README.md` is user-facing and is included in the VSIX.
- `CONTRIBUTING.md`, `docs/`, and other maintainer-facing files stay out of the
  VSIX.

## Product Guardrails

- Launch supported editors with `--user-data-dir` instead of mutating auth or
  session data.
- Treat the default userdata as the normal editor launch with no custom
  `--user-data-dir`.
- Keep managed userdata host-scoped and use short paths.
- Preserve behavior across macOS, Linux, and Windows.

## Testing And Packaging

- Prefer focused behavior tests for product changes.
- After packaging-related changes, rebuild the VSIX and inspect its contents.
- Keep runtime artifacts in the VSIX; exclude source, tests, docs, scripts, and
  maintainer metadata.

## Useful References

- `CONTEXT.md`
- `docs/adr/0001-use-supported-editor-userdata-roots.md`
- `docs/strategy/mvp-contract.md`
