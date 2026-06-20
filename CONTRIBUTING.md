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
npm run fix
npm test
npm run build
npm run package:vsix
```

`npm run check` is the readonly quality gate. `npm run fix` applies safe Knip
cleanup first, then Biome formatting, lint fixes, and import organization.

## Dogfood

Build and install a local pre-release VSIX into VS Code and Cursor:

```sh
npm run dogfood
```

The script writes `dist/userdata-switcher-<version>-dogfood.vsix`, installs it
with `--force`, and does not change `package.json`.

## Release

Before releasing, add the next version entry to `CHANGELOG.md` and commit all
feature or fix work. Then run from `main`:

```sh
npm version patch
```

Use `patch`, `minor`, or `major`. `preversion` checks the branch, changelog,
remote sync, and runs `check`, `test`, and `build`. `npm version` bumps,
commits, and tags. `postversion` writes the VSIX to `dist/release` and pushes
`main` with tags.

Upload the VSIX from `dist/release` manually in the Visual Studio Marketplace
publisher portal. Open VSX can use the same release artifact later.

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
