# Archived SQLite account-switch spike

This directory contains historical research from 2026-06-06.

It tested whether Cursor's active subscription could be changed by mutating
`state.vscdb`, cookies, and related persisted state. The result was useful, but
the approach is rejected for the product.

## Product Decision

Do **not** use this spike as a recovery path, product option, or implementation
template.

The product direction is now:

```text
open Cursor with a selected --user-data-dir
```

Each named Cursor Userdata has its own isolated Cursor data root and is signed in
through Cursor normally once. The extension/launcher should orchestrate launching
Cursor with the right userdata root. It should not edit Cursor auth databases.

## What This Spike Proved

- `cursorAuth/*` rows are not enough for a working account switch.
- Cursor persists non-auth identity context such as `applicationUser` and Statsig
  state outside the auth slice.
- A full Cursor process restart is required; `Developer: Reload Window` is not a
  sufficient boundary.
- Full DB/session mutation can work in a controlled test, but it is too broad and
  risky for the product.
- Existing chat editors can point at account-specific composer data and become
  stuck on `Loading Chat` when state is mixed.

These findings support the `--user-data-dir` architecture: account identity
belongs to the whole Cursor userdata root.

## Why The Spike Is Rejected

The mutation path touches sensitive and unstable Cursor internals:

- OAuth tokens and refresh tokens
- `User/globalStorage/state.vscdb`
- Chromium cookies and session storage
- workspace UI state
- chat/composer persistence

It also depends on SQLite internals and Cursor storage layouts that can change
between Cursor releases. The current product must not rely on this.

## Running The Spike

Prefer not to run these commands during product development. They remain only for
historical reproduction and should be treated as unsafe research tooling.

```bash
npm run research:sqlite-spike -- diagnose
npm run research:sqlite-spike -- list
```

Commands that save, switch, refresh, or repair accounts mutate or depend on local
Cursor auth/session state and are outside the product path.
