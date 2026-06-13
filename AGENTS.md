# Agent instructions

## Agent skills

### Issue tracker

GitHub Issues on `domoarigatomrburato/userdata-switcher`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary with default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Maintenance lessons

- When changing repository layout, update build scripts, editor tasks, ignore
  rules, packaging rules, and validation commands in the same pass.
- Use `npm run fix` as the autofixing command. `npm run check` is the readonly
  CI-style gate and should not mutate files.
- When deleting an implementation path, remove its runnable commands and stale
  documentation references in the same pass.
- After packaging-related changes, inspect the produced artifact contents. The
  artifact should include runtime files only, not source, tests, local tooling,
  or generated development metadata.
- Use `npm run dogfood` when explicitly asked to build and install a local
  pre-release VSIX into VS Code and Cursor. Do not run it casually because it
  mutates the user's installed editor extensions.
- Use `npm run release -- <major|minor|patch>` only when explicitly asked to
  release. It bumps versions, validates, empties `dist/release`, writes the
  Marketplace-uploadable VSIX there, commits, tags, and pushes.
- Marketplace publishing is manual for now: upload the VSIX from `dist/release`
  in the publisher portal. Do not add PAT, Azure, Entra/OIDC, or tag-publish CI
  automation unless explicitly requested again.
- For bug fixes, prefer behavior tests that fail before the change and pass after
  it. Cover the public contract rather than private implementation shape.
- For shared persisted state, assume multiple windows or processes may write in
  sequence. Reload current state before mutating, and avoid writing from stale
  in-memory snapshots.
- For launcher/process code, handle asynchronous startup failures explicitly;
  synchronous `try`/`catch` is not enough for spawned process errors.
