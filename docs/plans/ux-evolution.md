# UX Evolution Proposal

Status: Scoped. Committed near-term work is **Phase 1 (best-possible quick
launcher, no sidebar)** plus **Phase 1b (create an app shortcut for a userdata)**.
Everything else is parked (Section 11) until those land and prove worth more.
Scope: Evolve the Cursor/VS Code UI for the **current** feature set. No new
capabilities, no settings sync (explicitly out of scope — see "Decisions").

This document integrates two independent UX analyses and reconciles them against
the actual codebase plumbing. Where a suggestion is technically infeasible or
architecturally wrong for this project, it is corrected here rather than copied.

---

## 1. Where the UI is today

The entire surface is **one status bar item -> one flat Quick Pick**, behind a
clean `UserdataSwitcherUi` seam (`src/userdataSwitcherApp.ts`).

- **Status bar** (`src/labels.ts`): `$(layers) Work (default)` (left, priority
  100). Tooltip: `Current Cursor Userdata: <label>`. Click runs
  `userdataSwitcher.openWithUserdata`.
- **Open With Userdata Quick Pick** (`src/menu.ts`): a flat list that mixes two
  different jobs — *navigation* (other userdatas to open) and *management*
  (`Rename current`, `Reveal current`, `Create`, `Delete`) under an "Actions"
  separator.
- **Sub-flows** are sequential modals: create = input box -> **modal
  information message** for seed/empty (`pickUserdataCreationMode`) -> launch;
  delete = its own Quick Pick -> warning confirm.
- **Commands** (`package.json`): six commands (open, create, rename, show,
  reveal, delete), palette-only, no icons or keybindings.

What the MVP gets *right* and must be preserved: the interaction model matches
the domain. **Userdata is a process boundary, not an in-window switch**
(`CONTEXT.md`: "Userdata Boundary"). The status bar answers "which identity is
this window?" and the picker launches parallel windows. This must not regress
into looking like a profile switcher.

---

## 2. Core UX tensions

1. **One flat Quick Pick conflates "go somewhere" with "manage something."**
   Opening `Personal` (the daily 90% action) costs the same as deleting a
   userdata (rare, destructive). Dangerous actions sit next to safe ones.
2. **Management is current-window-centric, which is backwards for this product.**
   You can only *rename* the userdata you are currently in, and *reveal* the
   current one. The headline use case is several windows in parallel, so the
   userdata you most want to manage (e.g. "Client A", open in another window) is
   the one you cannot act on without first switching into it.
3. **No window identity at a glance.** With three windows open
   (Work / Personal / Client A), only the small status bar text distinguishes
   them. This is the #1 daily friction for the actual use case.
4. **No live state.** Running-instance detection already exists (used for
   deletion) but is never surfaced in the menu.
5. **Onboarding is invisible.** A `$(layers)` icon with no welcome state.
   First-run discovery relies entirely on the README.
6. **"Open With" reads like "switch."** Users may expect the current window to
   change; the extension spawns a new process instead.

---

## 3. Design principles (keep these)

1. **This window != other windows** — always show the current context first.
2. **Open = new window** — never imply hot-swap of the current window.
3. **Parallel by default** — optimize for "Work and Personal side by side."
4. **Progressive disclosure** — launch is one click; admin is one level deeper.
5. **Running-state cost scales with attention** — refresh is driven by user
   attention, not a blind clock. An ephemeral surface (Quick Pick) computes once
   on open. A persistent surface (tree) refreshes on attention signals
   (visibility, window focus, the extension's own mutations, manual Refresh), and
   may run a timer **only while the view is visible**. No work happens when no
   one is looking. See Section 6, constraint C3.
6. **Native, zero-friction surfaces only** — status bar, Quick Pick, tree view.
   No webview dashboards.

---

## 4. Decisions already made in discussion

- **Settings sync is OUT of scope.** Drift after the one-time copy
  (`src/preferences.ts` seeds `User/settings.json`, `User/keybindings.json`,
  `User/snippets` once) stays the behavior. Continuous or selective sync was
  considered and rejected as too complex and as fighting VS Code's
  single-owner `settings.json` model. Theme drift is arguably a *feature*
  (window identity), not a bug.
- **No webview.** A stepped Quick Pick covers every wizard need.
- **No in-window "switch userdata."** Violates the boundary model. `--user-data-dir`
  is a process-launch argument; a running window's process is bound to its
  userdata root for its lifetime, so "switch" always means launch a new process
  (a new window) — never an in-place swap. See Section 11 for the parked
  chooser/launcher exploration that ran into this wall.
- **No sidebar / tree view for now.** Decided to keep the surface to the quick
  launcher only. The tree (old Phase 2) is parked, not cancelled (Section 11).
- **App shortcuts have no lifecycle management.** Creating a shortcut is
  fire-and-forget — no rename-sync, no delete-cleanup. Note the actual blast
  radius is small: a shortcut encodes the userdata **path**
  (`relativeDataDir = u/<id>`), not the label, and `renameUserdata` only changes
  the label (`id`/`relativeDataDir` are immutable). So **rename leaves the
  shortcut fully functional** — only its own display name is cosmetically out of
  date. **Only delete** (which trashes the folder) yields a truly
  non-functioning shortcut. Both are **accepted**; keeps the feature trivial and
  side-effect-free.

---

## 5. Recommended evolution (phased)

Phases are ordered by leverage-to-effort. **Committed near-term work is Phase 1
and Phase 1b only.** Phases 2–5 are parked (Section 11) — kept for the record,
not scheduled.

### Phase 1 — Best-possible quick launcher (committed) — DO NOW

Make the existing status-bar Quick Pick as good as it can be, with **no new
surface** (no sidebar). Fix the mental model in place.

```
+- Open with Userdata ------------------------------+
| Current window: Work (default)                    |
+---------------------------------------------------+
| Personal          running                         |
| Client A          idle                            |
+---------------------------------------------------+
| $(add)  Create new userdata...                    |
| $(gear) Manage userdatas...                       |
+---------------------------------------------------+
```

Changes:
- **Pin current as a header row**, described as "this window"; do not list it as
  a launch target. (`buildOpenWithUserdataMenuItems` already filters current for
  managed; formalize it.)
- **Show running/idle per row**, computed **on menu open** (not polled), via
  `isUserdataEditorInstanceRunning`. Show `running` or `idle` only — see
  constraint C1 (no window counts).
- **Move admin behind "Manage userdatas..."** -> a second Quick Pick where
  rename / reveal / delete can target **any** userdata (fixes tension #2),
  with destructive actions one level deeper (principle 4).
- **Rename the user-facing copy to teach "new window"** (decided: breaking
  muscle memory is acceptable). Two separable changes:
  - *Title + picker/tooltip copy* — free, no compatibility cost; this alone
    fixes the "sounds like switch" problem. Recommended title:
    `Open Userdata in New Window`; placeholder:
    `Select a userdata to open in a new window`; keep the "Current window: ..."
    header.
  - *Command id* (optional tidiness) — if renamed to e.g.
    `userdataSwitcher.openInNewWindow`, keep the old id working as a **hidden
    runtime alias** bound to the same handler (not listed in
    `contributes.commands`, so it stays out of the palette) so existing
    user-authored keybindings don't silently break. The extension ships no
    default keybindings, so only user keybindings are at risk. Bind both ids to
    the same handler directly — do not forward via `executeCommand`. Note the
    deprecation in `CHANGELOG.md`; drop the alias in a future major.
  - *Keep docs in sync*: `CONTEXT.md` defines "Open With Userdata" and
    "Userdata Menu" as canonical terms. If the user-facing concept name changes,
    update `CONTEXT.md` and `README.md` in the same pass (per the `AGENTS.md`
    maintenance lessons on updating cross-references together).
  - Recommendation: renaming the title/copy is the high-value, zero-risk move;
    the id rename is cosmetic and optional.

Touch points: `src/menu.ts` (grouping, current-as-header, running metadata),
`src/userdataSwitcherApp.ts` (orchestration of the "Manage" sub-pick), and the
`menu.test.ts` pattern for the item builders. Stays within the existing
`UserdataSwitcherUi` seam.

Also cheap and worth bundling:
- **Keybinding** for the open picker.
- **Launch-failure notification** with an "Open Output" action (the channel is
  already wired in `src/extension.ts`).

### Phase 1b — Create an app shortcut for a userdata (committed)

Removes the daily two-step launch (open default editor -> then open the custom
userdata) by generating a native, double-clickable launcher per userdata that
boots the editor straight into that userdata from the OS.

A command **"Create app shortcut for this userdata"** (offered per userdata in
the launcher's "Manage" entry, and/or as a palette command) writes the
platform-native launcher. Everything it needs is already computed by
`buildLaunchCommand` (`src/launcher.ts`): the editor binary
(`discoverEditorCli`), `--user-data-dir`, and `--extensions-dir`
(`resolveSharedExtensionsDirectory`).

Per-platform artifact:
- **macOS** — a minimal generated `.app` bundle (`Info.plist` + a shell stub that
  execs the editor binary with the args). Dock-pinnable, Spotlight-searchable,
  named `Cursor — Work`. Locally generated (not downloaded), so it carries no
  `com.apple.quarantine` attribute and should launch without the "unidentified
  developer" wall — verify on a clean machine.
- **Windows** — a `.lnk` (target = `.exe`, args baked in) on Desktop / Start
  Menu; pin-to-taskbar works. Creatable via PowerShell `WScript.Shell` (already
  shelled out to on Windows).
- **Linux** — a `.desktop` file in `~/.local/share/applications/`.

Native launchers start fresh from the OS shell, so they sidestep the
`ELECTRON_*`/`VSCODE_*` env that `sanitizeEditorLaunchEnvironment` strips when
launching from inside the editor.

**Decided: no lifecycle management.** Fire-and-forget — no rename-sync, no
delete-cleanup, no stale-shortcut detection. The blast radius is small because a
shortcut encodes the userdata **path** (`relativeDataDir`), not the label:
- **Rename** changes only the label (`id`/`relativeDataDir` are immutable), so
  the shortcut keeps launching the right userdata — only its own display name is
  cosmetically out of date.
- **Delete** trashes the folder, so only then does the shortcut stop working.
Both are accepted. This keeps the feature trivial and free of cross-surface
bookkeeping.

Reframe to keep in mind: the very first editor launch is always the default
userdata (the extension only exists once an editor runs), so this is a one-time
setup cost — create the shortcuts once, then launch userdatas directly forever.

### Phase 2 — (PARKED) Sidebar "Userdatas" tree view (medium effort, best long-term home)

A `TreeDataProvider` is the honest fit: a list of entities with state, not a
settings panel. Per-item context menus are natively better than Quick Pick
buttons.

```
USERDATAS (Cursor)
  Work (default)     <- this window
  Personal           running
  Client A           idle
  [+] Create userdata
```

- Per-item context menu (`contributes.menus`): Open in new window · Reveal ·
  Rename · Delete.
- Title-bar actions: Create, Refresh running state (manual).
- `viewsWelcome` markdown for the empty state (addresses onboarding, tension #5):
  "No managed userdata yet — create one."
- Coexists with the status bar, which stays the compact "this window" mirror.

**Running state on a persistent surface (resolves the "pull, not push"
tension).** A Quick Pick computes once on open because it is ephemeral; a tree
is persistent, so badges that never refresh would go *stale and misleading*
(close a window elsewhere, the tree still says `running`). The fix is
attention-driven refresh, not a blind background poller:

- Refresh on `TreeView.onDidChangeVisibility` (becomes visible), on
  `window.onDidChangeWindowState` (editor refocus), after the extension's own
  open/launch and delete/quit actions, on expand, and on a manual Refresh button.
- If true liveness is wanted, run a timer **only while the view is visible**
  (start on visibility, stop on hide). Cost is paid only when there is a viewer.
- Debounce/coalesce bursts and guard against overlapping async probes.
- **Backed by a batched probe** (see C3 / Section 10): enumerate processes once
  and match all userdata roots in a single pass so a full refresh is O(1)
  process listings, not O(N). This is what makes event-driven refresh — or a
  visibility-gated timer — affordable.

This is a real commitment (new contribution points, new UI maintenance). Build
it only when picker-based management becomes the bottleneck.

### Phase 3 — (PARKED) Onboarding (medium effort)

- **`viewsWelcome` / a `contributes.walkthroughs` walkthrough** that teaches the
  *create-your-second-userdata* workflow. NOTE: the common fresh user is in the
  **default userdata** (already a known registry entry), NOT "unmanaged". The
  onboarding gap is "why would I create a second one?", not "register this
  window." Do not build an "adopt this window's userdata" flow as a headline
  feature — see constraint C4.
- **Create as a stepped Quick Pick** (label -> init mode -> optional open-now),
  replacing the input-box-then-modal chain. Reuses `pickUserdataCreationMode`
  and `provisionManagedUserdata`; mostly UI sequencing.

### Phase 4 — (PARKED) Workspace affinity (high daily value, has a gotcha)

"This repo usually opens as Personal." Turns the tool from "launcher when I
remember" into "habit per project."

- **Storage MUST be the tool-owned registry under the store root**, keyed by
  folder path — NOT `workspaceState`. `workspaceState` lives inside the current
  userdata root and is invisible from other userdatas and from a fresh default
  window, which is exactly where the preference is needed. See constraint C5.
- Surfaces: Explorer folder context menu "Open folder with userdata ->";
  a command "Open workspace with preferred userdata"; a subtle status bar hint
  on mismatch.
- Honest friction: honoring a preference when a folder is opened in the "wrong"
  userdata means **relaunching** into another window. The real feature is
  "detect mismatch -> offer to reopen elsewhere," not a silent switch.

### Phase 5 — (PARKED) Polish & power user

- Recent userdatas at top of the picker (last 2-3 launches).
- Per-userdata icon/glyph (codicon or emoji prefix) for visual scanning.
  Constraint: status bar background color is limited to warning/error theme
  colors only — identity must come from text/icon, not arbitrary color (C2).
- A few settings: default creation mode, status bar visibility, confirm-delete.
  (No "poll interval" setting — running-state refresh is attention-driven and
  batched, not a configurable clock; C3.)

---

## 6. Constraints and corrections (the part most easy to get wrong)

These correct specific suggestions from the source plans that are infeasible or
wrong against this codebase.

- **C1 — No window counts.** `isUserdataEditorInstanceRunning`
  (`src/runningEditorInstance.ts`) is a boolean. macOS/Linux: a single IPC
  socket probe (`probeRunningUserdataInstance`). Windows:
  `listMainProcessIdsForUserdataRoot` counts *main* processes (~1 per userdata;
  helpers filtered). Neither yields a per-userdata **window count**. Show
  `running` / `idle` only; "running · 2 windows" would be fabricated.
- **C2 — Status bar color is limited.** VS Code only allows
  `statusBarItem.warningBackground` / `errorBackground` theme colors. Arbitrary
  per-userdata colors are impossible. Window identity must be text/icon-based.
- **C3 — Running-state cost scales with attention; no free-running poller.**
  Running detection is costly: the Windows path spawns PowerShell and enumerates
  *all* system processes per call; the mac path is a socket probe per userdata. A
  5s timer that runs whether or not anyone is looking is the thing to avoid.
  Instead:
  - Ephemeral surfaces (Quick Pick): compute once on open.
  - Persistent surfaces (tree): refresh on attention signals — visibility,
    window focus, post-mutation, expand, manual Refresh — and optionally a timer
    gated to **only while the view is visible**.
  - **Batch the probe** so a full refresh is one process listing, not N: today
    `isUserdataEditorInstanceRunning` is per-root, so refreshing N userdatas on
    Windows means N `Get-CimInstance` enumerations. Add a batch variant that
    enumerates once and matches all roots (mac socket probes are individually
    cheap). This makes occasional refresh affordable and is the enabler for the
    tree.
  - There is therefore no "poll interval" setting.
- **C4 — "Focus running window" is not a real capability.** No extension API
  focuses another instance's window. Relaunching with a running userdata relies
  on the editor's singleton behavior to focus the existing window. Offer one
  "Open / focus" action, not two.
- **C5 — Workspace affinity belongs in the registry, not `workspaceState`.**
  See Phase 4. `workspaceState` is siloed per userdata root.
- **C6 — "Unmanaged" is an edge case, not the first-run state.** A Managed
  Userdata is a tool-owned directory under the store root with a
  `relativeDataDir`. Adopting an arbitrary external root as managed is a data
  model change, not UI sequencing. The fresh user is normally in the **default**
  userdata, which is already known. Onboarding should teach "create a second
  one," not "register this window."

---

## 7. What to avoid

- In-window "switch userdata" (breaks the boundary model and auth state).
- Heavy webview dashboard (maintenance cost; tree view + good pickers cover it).
- Showing email/account from host SQLite (fragile, host-specific; labels are the
  right abstraction).
- Auto-sync settings between userdatas (contradicts "copy once, then drift";
  Section 4).
- A free-running running-state poller that works when nothing is visible. Refresh
  is attention-driven and batched instead (C3).

---

## 8. Information architecture

```mermaid
flowchart TB
  subgraph daily [Daily actions]
    SB[Status bar: current userdata]
    OP[Open in new window]
    WS[Workspace: open with preferred]
  end

  subgraph manage [Management]
    TV[Sidebar tree]
    CR[Create wizard]
    RN[Rename / Reveal / Delete]
  end

  subgraph state [State already available]
    REG[Registry]
    RUN[Running detection - attention-driven, batched]
    CUR[Current window detection]
  end

  SB --> OP
  SB --> TV
  WS --> OP
  TV --> OP
  TV --> CR
  TV --> RN
  REG --> TV
  RUN --> TV
  CUR --> SB
```

---

## 9. Recommended roadmap

| Priority | Change | Why |
|----------|--------|-----|
| **P0 (committed)** | Phase 1 quick launcher: current-as-header, on-open running badges, "Manage..." sub-pick; + keybinding + launch-failure notification | Fixes confusion and the current-only management wart without new surfaces; fits MVP appetite |
| **P0 (committed)** | Phase 1b create app shortcut for a userdata (no lifecycle) | Removes the daily two-step launch; trivial because launch args are already computed |
| **Parked** | Phase 2 sidebar tree view | Permanent home for the feature set; revisit only if picker management hurts |
| **Parked** | Phase 3 onboarding (`viewsWelcome` / walkthrough, stepped create) | Unblocks users who never created a second userdata |
| **Parked** | Phase 4 workspace affinity (registry-keyed) | Daily win for multi-client workflows; mind relaunch friction and storage location |
| **Parked** | Phase 5 recents, icons, settings | Delight and polish |
| **Parked** | Companion menu-bar/tray app (Section 11) | Best answer to cold-start launch, but a second artifact: shared-core refactor + signing/notarization |

---

## 10. Implementation notes (codebase-fit)

- `src/menu.ts` — item grouping, running metadata, current-window pinning, the
  "Manage" sub-menu items.
- `src/userdataSwitcherApp.ts` — orchestration; add the tree provider alongside
  existing commands when Phase 2 lands.
- `UserdataSwitcherUi` (the seam) — extend with tree-view registration, view
  visibility (`onDidChangeVisibility`) and window-focus (`onDidChangeWindowState`)
  signals for attention-driven refresh, and — if richer pickers are wanted — a
  persistent `createQuickPick`.
- `src/runningEditorInstance.ts` — already the right primitive; call it on
  demand. Add a **batched** variant that enumerates processes once and matches
  all userdata roots in a single pass (Section 6, C3), so a tree refresh is O(1)
  process listings. Do not add a free-running poller; any timer is gated to view
  visibility.
- For the command rename (Phase 1): the new id is the only entry in
  `contributes.commands`; bind the legacy id `userdataSwitcher.openWithUserdata`
  as a hidden runtime alias to the same handler. Update `CONTEXT.md` and
  `README.md` if the canonical concept name changes.
- For Phase 1b (app shortcut): reuse `buildLaunchCommand` /
  `discoverEditorCli` / `resolveSharedExtensionsDirectory` to assemble the
  binary + args; add a platform-dispatched shortcut writer (`.app` / `.lnk` /
  `.desktop`). Keep the artifact builders pure (input: binary, args, label,
  target path; output: file contents) so they test like the existing pure
  helpers. No registry coupling — shortcuts are not tracked (no lifecycle).
- Tests — the `menu.test.ts` / `extension.test.ts` pattern ports directly to
  tree-item builders, the same way `buildOpenWithUserdataMenuItems` is tested
  today. The batched running-state matcher is pure and testable like
  `commandLineUsesUserdataRoot` already is.

---

The through-line: stop treating everything as one Quick Pick. Status bar answers
"where am I?", a tree (eventually) answers "what exists and what's running?",
and pickers stay for fast "open X" — with workspace memory on top. Live state is
refreshed in proportion to attention — once on open for ephemeral surfaces,
attention-driven and batched for the persistent tree — and never computed when
no one is looking.

---

## 11. Parked ideas / future tracks

Explored in discussion, deliberately **not** in current scope. Recorded so the
reasoning isn't relearned later.

### Companion menu-bar (macOS) / tray (Windows/Linux) app

An optional standalone helper that lives in the menu bar / notification area and
launches/manages userdatas even when no editor is running. It is the best answer
to the cold-start problem (no need to open the default editor first), and a
natural home for an always-on running-state dashboard.

Why parked, not adopted:
- **Make-or-break is the shared core, not the UI.** The app logic is already
  decoupled from VS Code — `userdataSwitcherApp.ts` imports no `vscode` and
  talks through the `UserdataSwitcherUi` seam; the registry lives under the store
  root and already assumes multiple processes. So a companion is essentially a
  second `UserdataSwitcherUi` implementation over the same core **if** it stays
  in the TS/JS ecosystem. Going native (Swift/Rust/Go) means reimplementing the
  whole launch/registry/detection contract in another language — permanent drift
  risk in exactly the fiddly platform code. Recommendation if ever pursued:
  extract a shared TS core consumed by both the VSIX and the app.
- **"Optional" does not reduce the build cost.** A VSIX can't install a tray app,
  so it needs its own signed/notarized installer (Apple Developer account;
  Windows Authenticode), auto-start-at-login glue, and an update channel —
  separate from the current `npm version` -> marketplace flow. Linux tray
  support is unreliable.
- **Responsibility split, to stay complementary:** extension owns "I'm in here"
  (status bar) and create-from-current-settings; companion owns "from outside"
  (always-available launcher + dashboard). Hold the companion to launcher +
  dashboard; resist it becoming a second product.

### Chooser / launcher as the editor entry point (and the in-window wall)

Iteration that wanted a chooser to pop at startup and load a userdata into the
*current* window, with a "load by default" option. Conclusions:
- **In-window swap is impossible** (see Decisions). `--user-data-dir` is fixed at
  process launch; an extension can't rebind its own host. "Load into current
  window" can only be "launch a new process, close this window" — a relaunch,
  not a swap, and not guaranteed to reuse this window (singleton focus).
- **"Pop at start" / "load by default" belong to the external entry point**, not
  the in-editor extension. From inside the extension the editor has already
  booted default, so it produces a visible default-then-switch bounce plus an
  infinite-relaunch guard. A launcher/companion that starts the *first* process
  in the chosen userdata avoids the bounce entirely. (Phase 1b shortcuts are a
  static, no-process version of this entry point.)
- **The honest version of "load into this window"** is "reopen current workspace
  as X": open the same folder in a new window for userdata X (reuse
  `resolveWorkspaceArg`), then close the current window. This is the Phase 4
  affinity flow plus a close-current step; also parked.
