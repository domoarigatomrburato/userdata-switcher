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

## Release

When asked to release a new **patch**, **minor**, or **major** version:

1. **Add a `CHANGELOG.md` entry** for the next version at the top (below the
   header). Use [Keep a Changelog](https://keepachangelog.com/) sections
   (`Added`, `Changed`, `Fixed`, `Removed`, …). The section must be non-empty —
   `preversion` fails if it is missing or empty.
2. **Commit all pending work** on `main`, including the changelog entry. The
   working tree must be clean before `npm version` runs.
3. **Run** `npm version patch`, `npm version minor`, or `npm version major` as
   requested. Do not bump `package.json` manually.
4. **Let the hooks run.** `preversion` checks branch/changelog sync and runs
   `check`, `test`, and a production build. `npm version` commits the version
   bump and creates the tag. `postversion` pushes `main` with tags.
5. **Confirm the Release workflow** on GitHub Actions completed and the release
   includes the VSIX asset.

`preversion` requires `main`, up to date with `origin/main`. Marketplace
publishing is still manual: download the VSIX from the GitHub release and
upload it in the publisher portal.

## Maintenance lessons

- When changing repository layout, update build scripts, editor tasks, ignore
  rules, packaging rules, and validation commands in the same pass.
- When deleting an implementation path, remove its runnable commands and stale
  documentation references in the same pass.
- After packaging-related changes, inspect the produced artifact contents. The
  artifact should include runtime files only, not source, tests, local tooling,
  or generated development metadata.
- For releases, follow **Release** above. Use `npm version` only when explicitly
  asked to release.
- For bug fixes, prefer behavior tests that fail before the change and pass after
  it. Cover the public contract rather than private implementation shape.
- For shared persisted state, assume multiple windows or processes may write in
  sequence. Reload current state before mutating, and avoid writing from stale
  in-memory snapshots.
- For launcher/process code, handle asynchronous startup failures explicitly;
  synchronous `try`/`catch` is not enough for spawned process errors.
