# Agent instructions

## Agent skills

### Issue tracker

GitHub Issues on `domoarigatomrburato/userdata-switcher`; external PRs are a triage
surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical five-role vocabulary with default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.

## Validation gates

**Always run gates in write mode.** Use `npm run fix`, not `npm run check`.

- `npm run fix` — the agent gate. Runs Knip autofixes, then Biome formatting,
  lint fixes, and import organization (`knip --fix && biome check --write .`).
- `npm run check` — readonly CI gate (`knip && biome ci .`). Humans and CI use
  this to verify a clean tree; agents should not substitute it for `fix`.

Treat every automatic change from `fix` as **safe and expected** — formatting,
lint autofixes, import organization, and Knip cleanup. When `fix` passes, do
**not** rerun `npm run check`, tests, or other gates solely because `fix`
mutated files. Rerun tests only when you still need behavioral verification of
your own code changes.

## Maintenance lessons

- When changing repository layout, update build scripts, editor tasks, ignore
  rules, packaging rules, and validation commands in the same pass.
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
