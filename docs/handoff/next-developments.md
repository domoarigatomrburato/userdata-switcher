# Userdata Switcher Handoff

## Current Baseline

- Repository: `domoarigatomrburato/userdata-switcher`
- Branch: `main`
- Implementation checkpoint: `101cb1b Stabilize userdata launch flow`
- Extension version at this checkpoint: `0.2.0`
- Rebuilt VSIX: `dist/userdata-switcher-0.2.0.vsix`

The project is now a VS Code-family extension, not Cursor-specific. It opens VS
Code, VS Code Insiders, and Cursor with isolated named userdata roots using
supported editor launch flags instead of mutating auth state.

This handoff was added after the implementation checkpoint, so use the commit
above as the behavioral baseline.

## What Was Validated

The user manually tested the rebuilt VSIX and confirmed it works.

Automated validation before the checkpoint commit:

- `npm run check`
- `npm run build`
- `git diff --check`
- `npm run package:vsix`
- VSIX content inspection confirmed runtime-only packaging: no `scripts/`,
  `src/`, docs, source maps, or compiled test output.

## Key Decisions To Preserve

- Do not revive the earlier auth-token or SQLite mutation spike. The supported
  approach is launching editor instances with distinct `--user-data-dir` roots.
- Managed userdata paths use a short cross-platform layout to avoid macOS Unix
  socket path limits, especially in stock VS Code.
- The default userdata is the editor's ordinary default launch with no custom
  `--user-data-dir`.
- Managed userdatas are host-scoped under the extension's shared data root.
- The status bar should show the current userdata for the current window.
- The picker title should be only `Current: <label>`, for example
  `Current: Work (default)`.
- The extension should not force `--reuse-window`; launching another userdata
  opens or focuses an appropriate editor process.
- `npm run check` is readonly and runs Knip before Biome. `npm run fix` is the
  autofixing command and uses the same order. Avoid reintroducing separate
  public `format` or `lint` scripts unless there is a concrete external need.

## Current Npm Surface

The public npm script set is intentionally small:

- `npm run check`
- `npm run fix`
- `npm test`
- `npm run build`
- `npm run package:vsix`
- `npm run dogfood`
- `npm run release -- <major|minor|patch>`
- `npm run vscode:prepublish` for VS Code/vsce compatibility

Cross-platform cleanup, packaging, dogfood, and release internals live in
`scripts/*.mjs`, and those helper scripts are excluded from the VSIX.

## Local Userdata Migration Note

The user's old Cursor managed userdata was migrated from the previous long-path
layout into the new short layout:

- old shape:
  `~/Library/Application Support/Userdata Switcher/Cursor/userdata/<id>/data`
- new shape: `~/Library/Application Support/udsw/cursor/u/<id>`

The old source store was intentionally left in place as a backup.

## Likely Next Development Tracks

1. Publish readiness

   Tighten README, screenshots, install instructions, marketplace wording,
   changelog, icon, and package metadata. CI is quality-only; releases produce a
   local VSIX in `dist/release` for manual Marketplace upload.

2. Delete managed userdata

   Add a user-facing way to delete a non-default managed userdata. This needs
   careful UX because deletion removes an editor userdata directory containing
   settings, extension state, caches, and login/session data. The default
   userdata must never be deletable.

3. Release automation

   Keep CI focused on checks, tests, build, and packaging. If Open VSX is added,
   reuse the `dist/release` artifact shape before introducing any publishing
   automation.

4. UX polish

   Review the command palette commands, picker actions, status bar copy,
   diagnostics output, and screenshots from the point of view of a first-time VS
   Code user and a Cursor user.

5. Migration behavior

   The local migration was manual. Decide whether the extension should include
   one-time migration from the old storage layout. Because the extension was not
   previously published, the default answer may be no.

## Suggested Skills

- `santommaso`: use for delete-userdata or any behavior-changing product slice.
- `simplify`: use after a feature slice to remove incidental complexity without
  changing behavior.
- `grill-with-docs`: use before publishing or adding deletion semantics, because
  terminology and user expectations matter.
- `gh-fix-ci`: use only after CI exists and a GitHub check fails.
- `handoff`: use when transferring context again.

## Useful Files To Read First

- `CONTEXT.md`
- `docs/adr/0001-use-supported-editor-userdata-roots.md`
- `docs/strategy/mvp-contract.md`
- `README.md`
- `package.json`
- `src/userdataSwitcherApp.ts`
- `src/registryStore.ts`
- `src/managedUserdataProvisioner.ts`
- `src/launcher.ts`
- `src/registry.ts`
- `src/manifest.test.ts`

## Cautions

- Do not store machine-specific absolute paths in the registry. Use host-scoped
  defaults and relative managed userdata paths.
- Preserve cross-platform behavior for macOS, Linux, and Windows.
- Preserve the macOS socket path guard and logging. VS Code can fail on long
  userdata paths even when Cursor appears to tolerate them.
- Before changing packaging, inspect the VSIX contents after rebuilding.
- Avoid expanding the npm script surface unless a real workflow needs it.
