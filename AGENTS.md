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
- Use the default project check command as an autofixing command. Its safe fixes
  are intended to be applied, so run it without treating those edits as risky.
- When deleting an implementation path, remove its runnable commands and stale
  documentation references in the same pass.
- After packaging-related changes, inspect the produced artifact contents. The
  artifact should include runtime files only, not source, tests, local tooling,
  or generated development metadata.
- For bug fixes, prefer behavior tests that fail before the change and pass after
  it. Cover the public contract rather than private implementation shape.
- For shared persisted state, assume multiple windows or processes may write in
  sequence. Reload current state before mutating, and avoid writing from stale
  in-memory snapshots.
- For launcher/process code, handle asynchronous startup failures explicitly;
  synchronous `try`/`catch` is not enough for spawned process errors.
