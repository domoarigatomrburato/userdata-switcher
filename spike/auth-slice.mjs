#!/usr/bin/env node
/**
 * Spike: validate auth-slice hot-swap in live state.vscdb.
 * After `switch`, fully quit/reopen Cursor and check Settings → Account.
 */
import { DatabaseSync } from "node:sqlite";
import { execFileSync, execSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const AUTH_PREFIX = "cursorAuth/";
const STORE_DIR = path.join(
  os.homedir(),
  ".cursor-subscription-quick-switcher",
);
const ACCOUNTS_DIR = path.join(STORE_DIR, "accounts");
const BACKUPS_DIR = path.join(STORE_DIR, "backups");
const BROWSER_PROFILES_DIR = path.join(STORE_DIR, "browser-profiles");

/** Chromium session files the abandoned VSIX also swapped (unverified here). */
const SESSION_FILES = ["Cookies", "Cookies-journal"];
const SESSION_DIRS = ["Local Storage", "Session Storage"];
const FULL_DB_FILES = [
  "state.vscdb",
  "state.vscdb.backup",
  "state.vscdb-wal",
  "state.vscdb-shm",
];
const APPLICATION_USER_KEY =
  "src.vs.platform.reactivestorage.browser.reactiveStorageServiceImpl.persistentStorage.applicationUser";
const STATSIG_BOOTSTRAP_KEY = "workbench.experiments.statsigBootstrap";
const DEFAULT_CURSOR_CREDS = {
  websiteUrl: "https://cursor.com",
  backendUrl: "https://api2.cursor.sh",
  authClientId: "KbZUR41cY7W6zRSdpSUJ7I7mLYBKOCmB",
};

function usage() {
  console.log(`Usage: npm run spike -- <command> [args]

Commands:
  status              Show live auth slice (email + plan)
  list                List saved account snapshots
  save <label>        Snapshot auth slice + Chromium session files
  switch <label>      Backup live state, apply saved snapshot
  login-link <label>  Browser login flow; update saved account tokens
  refresh <label>     Refresh a saved account token and update snapshot
  show <label>        Print a saved snapshot without applying
  diagnose            Disk email vs Cursor running; non-auth identity context

Options:
  --force             Overwrite existing snapshot on save
  --offline           Require Cursor to be fully quit (required for switch)
  --auth-only         Save/switch auth slice only (skip session files)
  --full-db           Save/switch full state.vscdb* like the marketplace VSIX
  --open-browser      Open login-link in a label-specific Chrome profile

Examples:
  npm run spike -- status
  npm run spike -- save personal
  npm run spike -- save work
  npm run spike -- save personal --force --full-db
  npm run spike -- login-link work --open-browser
  npm run spike -- switch personal --offline --full-db
`);
}

function ensureStore() {
  for (const dir of [STORE_DIR, ACCOUNTS_DIR, BACKUPS_DIR, BROWSER_PROFILES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    try {
      fs.chmodSync(dir, 0o700);
    } catch {
      // best effort
    }
  }
}

function cursorAppPath() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "Cursor");
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
      "Cursor",
    );
  }
  return path.join(home, ".config", "Cursor");
}

function cursorGlobalStoragePath() {
  const home = os.homedir();
  if (process.platform === "darwin") {
    return path.join(
      home,
      "Library",
      "Application Support",
      "Cursor",
      "User",
      "globalStorage",
    );
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
      "Cursor",
      "User",
      "globalStorage",
    );
  }
  return path.join(home, ".config", "Cursor", "User", "globalStorage");
}

function stateDbPath() {
  return path.join(cursorGlobalStoragePath(), "state.vscdb");
}

function stateDbSiblingPath(file) {
  return path.join(cursorGlobalStoragePath(), file);
}

function openDb({ readonly = false } = {}) {
  const dbPath = stateDbPath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`state.vscdb not found at ${dbPath}`);
  }
  const db = new DatabaseSync(dbPath, { readonly, enableForeignKeyConstraints: false });
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

function openSavedStateDb(label, { readonly = false } = {}) {
  const dbPath = path.join(accountFullDbDir(label), "state.vscdb");
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Saved full DB not found for '${label}' at ${dbPath}`);
  }
  const db = new DatabaseSync(dbPath, { readonly, enableForeignKeyConstraints: false });
  db.exec("PRAGMA busy_timeout = 5000");
  return db;
}

function rowValue(value) {
  if (value == null) return "";
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  return String(value);
}

function readAuthSlice(db) {
  const rows = db
    .prepare(
      `SELECT key, value FROM ItemTable WHERE key LIKE ? ORDER BY key`,
    )
    .all(`${AUTH_PREFIX}%`);

  /** @type {Record<string, string>} */
  const keys = {};
  for (const row of rows) {
    keys[row.key] = rowValue(row.value);
  }
  return keys;
}

function readItem(db, key) {
  const row = db
    .prepare(`SELECT value FROM ItemTable WHERE key = ?`)
    .get(key);
  return row ? rowValue(row.value) : undefined;
}

function parseJsonItem(db, key) {
  const value = readItem(db, key);
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function decodeJwtPayload(token) {
  if (!token || !token.includes(".")) return undefined;
  try {
    const [, payload] = token.split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}

function decodeJwtEmail(token) {
  const payload = decodeJwtPayload(token);
  return (
    payload?.email ??
    payload?.user_email ??
    payload?.preferred_username ??
    payload?.["https://cursor.com/email"]
  );
}

function writeAuthSlice(db, keys) {
  const upsert = db.prepare(
    `INSERT INTO ItemTable (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const [key, value] of Object.entries(keys)) {
      if (!key.startsWith(AUTH_PREFIX)) {
        throw new Error(`Refusing to write non-auth key: ${key}`);
      }
      upsert.run(key, value);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function isCursorRunning() {
  try {
    if (process.platform === "win32") {
      const out = execSync('tasklist /FI "IMAGENAME eq Cursor.exe"', {
        encoding: "utf8",
      });
      return out.includes("Cursor.exe");
    }
    if (process.platform === "darwin") {
      const out = execSync("pgrep -lf Cursor", { encoding: "utf8" });
      return /Cursor\.app\/Contents\/MacOS\/Cursor/.test(out);
    }
    execSync("pgrep -x cursor", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function assertCursorState({ offline }) {
  const running = isCursorRunning();
  if (offline && running) {
    throw new Error(
      "Cursor is still running. Quit Cursor (Cmd+Q), then re-run switch --offline.",
    );
  }
  if (!offline && running) {
    console.warn(
      "Warning: Cursor is running. It may overwrite disk auth from memory on reload.",
    );
    console.warn(
      "Prefer: quit Cursor, then: npm run spike -- switch <label> --offline",
    );
  }
}

function normalizeLabel(label) {
  const safe = label.trim();
  if (!safe || safe.includes("/") || safe.includes("..")) {
    throw new Error(`Invalid account label: ${label}`);
  }
  return safe;
}

function accountPath(label) {
  return path.join(ACCOUNTS_DIR, `${normalizeLabel(label)}.json`);
}

function accountSessionDir(label) {
  return path.join(ACCOUNTS_DIR, normalizeLabel(label), "session");
}

function accountFullDbDir(label) {
  return path.join(ACCOUNTS_DIR, normalizeLabel(label), "state");
}

function accountBrowserProfileDir(label) {
  return path.join(BROWSER_PROFILES_DIR, normalizeLabel(label));
}

function copyFileAtomic(source, destination) {
  const temp = `${destination}.tmp`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, temp);
  fs.renameSync(temp, destination);
}

function copyDirRecursive(source, destination) {
  if (!fs.existsSync(source)) {
    return false;
  }
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name);
    const dest = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(src, dest);
    } else {
      copyFileAtomic(src, dest);
    }
  }
  return true;
}

function removePath(target) {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
}

function copyExistingFiles(files, sourceDir, destinationDir) {
  let copied = 0;
  for (const file of files) {
    const src = path.join(sourceDir, file);
    if (fs.existsSync(src)) {
      copyFileAtomic(src, path.join(destinationDir, file));
      copied += 1;
    }
  }
  return copied;
}

function saveSessionBundle(label) {
  const appPath = cursorAppPath();
  const dest = accountSessionDir(label);
  removePath(dest);
  fs.mkdirSync(dest, { recursive: true, mode: 0o700 });

  let copied = 0;
  for (const file of SESSION_FILES) {
    const src = path.join(appPath, file);
    if (fs.existsSync(src)) {
      copyFileAtomic(src, path.join(dest, file));
      copied += 1;
    }
  }
  for (const dir of SESSION_DIRS) {
    if (copyDirRecursive(path.join(appPath, dir), path.join(dest, dir))) {
      copied += 1;
    }
  }
  return { dest, copied };
}

function saveFullStateDb(label) {
  const dest = accountFullDbDir(label);
  removePath(dest);
  fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
  const copied = copyExistingFiles(FULL_DB_FILES, cursorGlobalStoragePath(), dest);
  if (!fs.existsSync(path.join(dest, "state.vscdb"))) {
    throw new Error(`Full DB save failed: state.vscdb was not copied to ${dest}`);
  }
  return { dest, copied };
}

function restoreSessionBundle(label) {
  const appPath = cursorAppPath();
  const source = accountSessionDir(label);
  if (!fs.existsSync(source)) {
    return { restored: false };
  }

  for (const file of SESSION_FILES) {
    const src = path.join(source, file);
    if (fs.existsSync(src)) {
      copyFileAtomic(src, path.join(appPath, file));
    }
  }
  for (const dir of SESSION_DIRS) {
    const src = path.join(source, dir);
    if (fs.existsSync(src)) {
      const dest = path.join(appPath, dir);
      removePath(dest);
      copyDirRecursive(src, dest);
    }
  }
  return { restored: true, source };
}

function restoreFullStateDb(label) {
  const source = accountFullDbDir(label);
  if (!fs.existsSync(path.join(source, "state.vscdb"))) {
    return { restored: false };
  }

  for (const file of FULL_DB_FILES) {
    removePath(stateDbSiblingPath(file));
  }
  const copied = copyExistingFiles(FULL_DB_FILES, source, cursorGlobalStoragePath());
  return { restored: true, source, copied };
}

function hasSessionBundle(label) {
  return fs.existsSync(accountSessionDir(label));
}

function hasFullStateDb(label) {
  return fs.existsSync(path.join(accountFullDbDir(label), "state.vscdb"));
}

function loadSavedAccount(label) {
  const file = accountPath(label);
  if (!fs.existsSync(file)) {
    throw new Error(`No saved account '${label}' at ${file}`);
  }
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data.keys || typeof data.keys !== "object") {
    throw new Error(`Malformed account file: ${file}`);
  }
  return data;
}

function savedCursorCreds(label) {
  if (!hasFullStateDb(label)) {
    return { ...DEFAULT_CURSOR_CREDS };
  }

  const db = openSavedStateDb(label, { readonly: true });
  try {
    const appUser = parseJsonItem(db, APPLICATION_USER_KEY);
    const cursorCreds = appUser?.cursorCreds ?? {};
    return {
      websiteUrl: cursorCreds.websiteUrl ?? DEFAULT_CURSOR_CREDS.websiteUrl,
      backendUrl: cursorCreds.backendUrl ?? DEFAULT_CURSOR_CREDS.backendUrl,
      authClientId:
        cursorCreds.authClientId ?? DEFAULT_CURSOR_CREDS.authClientId,
    };
  } finally {
    db.close();
  }
}

function saveAccountFile(label, keys) {
  const email = keys[`${AUTH_PREFIX}cachedEmail`] ?? "(unknown)";
  const payload = {
    label,
    email,
    savedAt: new Date().toISOString(),
    keys,
  };
  const file = accountPath(label);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });
  return { file, email };
}

function upsertItem(db, key, value) {
  db.prepare(
    `INSERT INTO ItemTable (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

function writeSavedAuthTokenPair(label, tokenPair) {
  const saved = loadSavedAccount(label);
  const keys = { ...saved.keys };
  const accessToken = tokenPair.accessToken;
  const refreshToken = tokenPair.refreshToken;
  const email =
    tokenPair.email ??
    decodeJwtEmail(accessToken) ??
    keys[`${AUTH_PREFIX}cachedEmail`] ??
    saved.email;

  if (!accessToken || !refreshToken) {
    throw new Error("Both accessToken and refreshToken are required");
  }

  keys[`${AUTH_PREFIX}accessToken`] = accessToken;
  keys[`${AUTH_PREFIX}refreshToken`] = refreshToken;
  if (email) {
    keys[`${AUTH_PREFIX}cachedEmail`] = email;
  }

  const payload = {
    ...saved,
    email: email ?? saved.email,
    tokenUpdatedAt: new Date().toISOString(),
    keys,
  };
  fs.writeFileSync(accountPath(label), `${JSON.stringify(payload, null, 2)}\n`, {
    mode: 0o600,
  });

  if (!hasFullStateDb(label)) {
    return { updatedFullDb: false, email };
  }

  const db = openSavedStateDb(label, { readonly: false });
  try {
    db.exec("BEGIN IMMEDIATE");
    try {
      upsertItem(db, `${AUTH_PREFIX}accessToken`, accessToken);
      upsertItem(db, `${AUTH_PREFIX}refreshToken`, refreshToken);
      if (email) {
        upsertItem(db, `${AUTH_PREFIX}cachedEmail`, email);
      }

      if (tokenPair.selectedTeamId !== undefined) {
        const appUser = parseJsonItem(db, APPLICATION_USER_KEY);
        if (appUser?.aiSettings) {
          appUser.aiSettings.teamId = tokenPair.selectedTeamId;
          const teamIds = Array.isArray(appUser.aiSettings.teamIds)
            ? appUser.aiSettings.teamIds
            : [];
          if (
            tokenPair.selectedTeamId &&
            !teamIds.includes(tokenPair.selectedTeamId)
          ) {
            teamIds.push(tokenPair.selectedTeamId);
          }
          appUser.aiSettings.teamIds = teamIds;
          upsertItem(db, APPLICATION_USER_KEY, JSON.stringify(appUser));
        }
      }

      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  } finally {
    db.close();
  }

  return { updatedFullDb: true, email };
}

function backupLiveSlice(keys) {
  const email = keys[`${AUTH_PREFIX}cachedEmail`] ?? "unknown";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUPS_DIR, `${stamp}-${email}.json`);
  fs.writeFileSync(
    file,
    `${JSON.stringify({ savedAt: new Date().toISOString(), email, keys }, null, 2)}\n`,
    { mode: 0o600 },
  );
  return file;
}

function backupLiveFullSession(keys) {
  const email = keys[`${AUTH_PREFIX}cachedEmail`] ?? "unknown";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(BACKUPS_DIR, `${stamp}-${email}-full`);
  const globalDest = path.join(dir, "globalStorage");
  const appDest = path.join(dir, "app");
  fs.mkdirSync(globalDest, { recursive: true, mode: 0o700 });
  fs.mkdirSync(appDest, { recursive: true, mode: 0o700 });

  const dbFiles = copyExistingFiles(FULL_DB_FILES, cursorGlobalStoragePath(), globalDest);
  const sessionFiles = copyExistingFiles(SESSION_FILES, cursorAppPath(), appDest);
  let sessionDirs = 0;
  for (const sessionDir of SESSION_DIRS) {
    if (copyDirRecursive(path.join(cursorAppPath(), sessionDir), path.join(appDest, sessionDir))) {
      sessionDirs += 1;
    }
  }
  return { dir, dbFiles, sessionFiles, sessionDirs };
}

function summarize(keys) {
  return {
    email: keys[`${AUTH_PREFIX}cachedEmail`] ?? "(missing)",
    plan: keys[`${AUTH_PREFIX}stripeMembershipType`] ?? "(missing)",
    status: keys[`${AUTH_PREFIX}stripeSubscriptionStatus`] ?? "(missing)",
    signUpType: keys[`${AUTH_PREFIX}cachedSignUpType`] ?? "(missing)",
    keyCount: Object.keys(keys).length,
  };
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openLoginUrlInBrowser(label, loginUrl) {
  const url = loginUrl.toString();
  const profileDir = accountBrowserProfileDir(label);
  fs.mkdirSync(profileDir, { recursive: true, mode: 0o700 });

  if (process.platform === "darwin") {
    try {
      execFileSync(
        "open",
        [
          "-na",
          "Google Chrome",
          "--args",
          `--user-data-dir=${profileDir}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--disable-search-engine-choice-screen",
          "--disable-features=SignInProfileCreation,SigninInterception,SearchEngineChoiceTrigger",
          "--new-window",
          url,
        ],
        { stdio: "ignore" },
      );
      return { opened: true, profileDir, browser: "Google Chrome" };
    } catch {
      execFileSync("open", [url], { stdio: "ignore" });
      return { opened: true, profileDir: undefined, browser: "default" };
    }
  }

  if (process.platform === "win32") {
    execFileSync("cmd", ["/c", "start", "", url], { stdio: "ignore" });
    return { opened: true, profileDir: undefined, browser: "default" };
  }

  execFileSync("xdg-open", [url], { stdio: "ignore" });
  return { opened: true, profileDir: undefined, browser: "default" };
}

function shortenIdentity(value) {
  if (!value) return "(missing)";
  if (value.length <= 22) return value;
  return `${value.slice(0, 14)}…${value.slice(-6)}`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function refreshTokenRequest(refreshToken, creds) {
  const response = await fetch(`${creds.backendUrl}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: creds.authClientId,
      refresh_token: refreshToken,
    }),
  });
  const body = await readJsonResponse(response);
  return { status: response.status, ok: response.ok, body };
}

function extractTokenPair(body, fallbackRefreshToken) {
  const accessToken = body?.accessToken ?? body?.access_token;
  const refreshToken =
    body?.refreshToken ?? body?.refresh_token ?? fallbackRefreshToken;
  if (!accessToken || !refreshToken) {
    return undefined;
  }
  return { accessToken, refreshToken };
}

async function validateAndStoreToken(label, tokenPair) {
  const creds = savedCursorCreds(label);
  const validation = await refreshTokenRequest(tokenPair.refreshToken, creds);

  if (validation.body?.shouldLogout === true) {
    throw new Error(
      `Cursor rejected the new refresh token for '${label}' (shouldLogout=true).`,
    );
  }
  if (!validation.ok) {
    throw new Error(
      `Cursor refresh validation failed for '${label}' with HTTP ${validation.status}.`,
    );
  }

  const refreshedPair = extractTokenPair(validation.body, tokenPair.refreshToken);
  const finalPair = refreshedPair ?? tokenPair;
  const email =
    decodeJwtEmail(finalPair.accessToken) ??
    tokenPair.email ??
    loadSavedAccount(label).email;
  const write = writeSavedAuthTokenPair(label, {
    ...finalPair,
    email,
    selectedTeamId: tokenPair.selectedTeamId,
  });

  return {
    email: write.email,
    updatedFullDb: write.updatedFullDb,
    refreshStatus: validation.status,
    refreshOk: validation.ok,
    shouldLogout: validation.body?.shouldLogout,
  };
}

function readIdentityContext(db, keys) {
  const tokenPayload = decodeJwtPayload(keys[`${AUTH_PREFIX}accessToken`]);
  const applicationUser = parseJsonItem(db, APPLICATION_USER_KEY);
  const statsigBootstrap = parseJsonItem(db, STATSIG_BOOTSTRAP_KEY);
  return {
    tokenSubject: tokenPayload?.sub,
    tokenType: tokenPayload?.type,
    appTeamId: applicationUser?.aiSettings?.teamId,
    appTeamIds: applicationUser?.aiSettings?.teamIds,
    appMembershipType: applicationUser?.membershipType,
    statsigUserId: statsigBootstrap?.evaluated_keys?.userID,
    statsigTeamId: statsigBootstrap?.evaluated_keys?.teamID,
  };
}

function cmdStatus() {
  const db = openDb({ readonly: true });
  try {
    const keys = readAuthSlice(db);
    const s = summarize(keys);
    console.log("Live auth slice:");
    console.log(`  email:    ${s.email}`);
    console.log(`  plan:     ${s.plan}`);
    console.log(`  status:   ${s.status}`);
    console.log(`  sign up:  ${s.signUpType}`);
    console.log(`  keys:     ${s.keyCount} (${Object.keys(keys).join(", ")})`);
    console.log(`  database: ${stateDbPath()}`);
  } finally {
    db.close();
  }
}

function cmdDiagnose() {
  const running = isCursorRunning();
  const db = openDb({ readonly: true });
  let keys;
  let identityContext;
  try {
    keys = readAuthSlice(db);
    identityContext = readIdentityContext(db, keys);
  } finally {
    db.close();
  }
  const s = summarize(keys);
  const tokenMatchesStatsig =
    !identityContext.tokenSubject ||
    !identityContext.statsigUserId ||
    identityContext.tokenSubject === identityContext.statsigUserId;

  console.log("Spike diagnose:");
  console.log(`  cursor running:  ${running}`);
  console.log(`  disk email:      ${s.email}`);
  console.log(`  disk plan:       ${s.plan}`);
  console.log(`  token subject:   ${shortenIdentity(identityContext.tokenSubject)}`);
  console.log(`  token type:      ${identityContext.tokenType ?? "(missing)"}`);
  console.log(`  app teamIds:     ${JSON.stringify(identityContext.appTeamIds ?? [])}`);
  console.log(`  app membership:  ${identityContext.appMembershipType ?? "(missing)"}`);
  console.log(`  statsig user:    ${shortenIdentity(identityContext.statsigUserId)}`);
  console.log(`  statsig team:    ${identityContext.statsigTeamId ?? "(missing)"}`);
  console.log(`  identity match:  ${tokenMatchesStatsig ? "yes" : "NO (non-auth state belongs to another account)"}`);
  console.log("");
  if (fs.existsSync(ACCOUNTS_DIR)) {
    for (const file of fs
      .readdirSync(ACCOUNTS_DIR)
      .filter((f) => f.endsWith(".json"))) {
      const data = JSON.parse(
        fs.readFileSync(path.join(ACCOUNTS_DIR, file), "utf8"),
      );
      const label = data.label;
      const match = data.email === s.email ? "matches disk" : "differs from disk";
      const session = hasSessionBundle(label) ? "session bundle yes" : "auth only";
      const fullDb = hasFullStateDb(label) ? "full DB yes" : "no full DB";
      console.log(`  saved ${label}: ${data.email} (${session}, ${fullDb}, ${match})`);
    }
  }
  console.log("");
  if (running) {
    console.log(
      "While Cursor is running, UI auth can differ from disk (in-memory session).",
    );
    console.log("Switch requires Cmd+Q first, then switch --offline, then reopen.");
  }
}

function cmdList() {
  if (!fs.existsSync(ACCOUNTS_DIR)) {
    console.log("No saved accounts yet.");
    return;
  }
  const files = fs
    .readdirSync(ACCOUNTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length === 0) {
    console.log("No saved accounts yet.");
    return;
  }
  console.log("Saved accounts:");
  for (const file of files) {
    const data = JSON.parse(
      fs.readFileSync(path.join(ACCOUNTS_DIR, file), "utf8"),
    );
    const session = hasSessionBundle(data.label) ? " +session" : "";
    const fullDb = hasFullStateDb(data.label) ? " +full-db" : "";
    console.log(
      `  ${data.label}  ${data.email}${session}${fullDb}  (saved ${data.savedAt})`,
    );
  }
}

function cmdSave(label, force, { authOnly, fullDb }) {
  const file = accountPath(label);
  if (fs.existsSync(file) && !force) {
    throw new Error(
      `Account '${label}' already exists. Use --force to overwrite.`,
    );
  }
  const db = openDb({ readonly: true });
  let keys;
  try {
    keys = readAuthSlice(db);
  } finally {
    db.close();
  }
  if (Object.keys(keys).length === 0) {
    throw new Error("No cursorAuth/* keys in live database. Are you signed in?");
  }
  const { file: written, email } = saveAccountFile(label, keys);
  console.log(`Saved auth '${label}' (${email}) → ${written}`);
  if (!authOnly) {
    const { dest, copied } = saveSessionBundle(label);
    console.log(`Saved session bundle (${copied} items) → ${dest}`);
  }
  if (fullDb) {
    const { dest, copied } = saveFullStateDb(label);
    console.log(`Saved full state DB (${copied} files) → ${dest}`);
  }
}

function cmdShow(label) {
  const data = loadSavedAccount(label);
  const s = summarize(data.keys);
  console.log(`Saved account '${label}':`);
  console.log(`  email:    ${s.email}`);
  console.log(`  plan:     ${s.plan}`);
  console.log(`  status:   ${s.status}`);
  console.log(`  savedAt:  ${data.savedAt}`);
  console.log(`  file:     ${accountPath(label)}`);
  console.log(
    `  session:  ${hasSessionBundle(label) ? accountSessionDir(label) : "(none — re-save without --auth-only)"}`,
  );
  console.log(
    `  full DB:  ${hasFullStateDb(label) ? accountFullDbDir(label) : "(none — re-save with --full-db)"}`,
  );
}

async function cmdRefresh(label) {
  const saved = loadSavedAccount(label);
  const refreshToken = saved.keys[`${AUTH_PREFIX}refreshToken`];
  if (!refreshToken) {
    throw new Error(`Saved account '${label}' has no refresh token`);
  }

  const creds = savedCursorCreds(label);
  const result = await refreshTokenRequest(refreshToken, creds);
  const bodyKeys = Object.keys(result.body ?? {});
  console.log(`Refresh '${label}':`);
  console.log(`  endpoint:     ${creds.backendUrl}/oauth/token`);
  console.log(`  http:         ${result.status}`);
  console.log(`  shouldLogout: ${String(result.body?.shouldLogout)}`);
  console.log(`  body keys:    ${bodyKeys.length ? bodyKeys.join(", ") : "(none)"}`);

  if (result.body?.shouldLogout === true) {
    throw new Error(
      `Saved refresh token for '${label}' is invalid/revoked. Re-login without Settings logout: npm run spike -- login-link ${label}`,
    );
  }
  if (!result.ok) {
    throw new Error(`Refresh request failed with HTTP ${result.status}`);
  }

  const tokenPair = extractTokenPair(result.body, refreshToken);
  if (!tokenPair) {
    console.log("  updated:      no replacement token returned");
    return;
  }

  const email = decodeJwtEmail(tokenPair.accessToken) ?? saved.email;
  const write = writeSavedAuthTokenPair(label, { ...tokenPair, email });
  console.log(`  updated:      ${accountPath(label)}`);
  console.log(`  full DB:      ${write.updatedFullDb ? accountFullDbDir(label) : "(none)"}`);
  console.log(`  email:        ${write.email}`);
}

async function cmdLoginLink(label, { openBrowser }) {
  const saved = loadSavedAccount(label);
  const creds = savedCursorCreds(label);
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(
    crypto.createHash("sha256").update(verifier).digest(),
  );
  const uuid = crypto.randomUUID();
  const loginUrl = new URL("/loginDeepControl", creds.websiteUrl);
  loginUrl.searchParams.set("challenge", challenge);
  loginUrl.searchParams.set("uuid", uuid);
  loginUrl.searchParams.set("mode", "login");
  loginUrl.searchParams.set("supportsSelectedTeamLogin", "true");

  const pollUrl = new URL("/auth/poll", creds.backendUrl);
  pollUrl.searchParams.set("uuid", uuid);
  pollUrl.searchParams.set("verifier", verifier);

  console.log(`Login link for saved account '${label}' (${saved.email}):`);
  console.log(loginUrl.toString());
  console.log("");
  if (openBrowser) {
    const opened = openLoginUrlInBrowser(label, loginUrl);
    console.log(
      `Opened ${opened.browser}${opened.profileDir ? ` profile at ${opened.profileDir}` : ""}.`,
    );
    console.log("Complete sign-in in the opened browser window.");
  } else {
    console.log("Open that URL in a private/dedicated browser session and sign in.");
  }
  console.log("Polling Cursor auth for up to 180 seconds...");

  const startedAt = Date.now();
  let lastProgressAt = startedAt;
  while (Date.now() - startedAt < 180_000) {
    const response = await fetch(pollUrl, {
      headers: {
        "x-ghost-mode": "false",
        "x-new-onboarding-completed": "false",
      },
    });
    const body = await readJsonResponse(response);

    if (response.ok) {
      const tokenPair = {
        accessToken: body?.accessToken ?? body?.access_token,
        refreshToken: body?.refreshToken ?? body?.refresh_token,
      };
      if (tokenPair.accessToken && tokenPair.refreshToken) {
        const email =
          decodeJwtEmail(tokenPair.accessToken) ??
          body?.email ??
          saved.email;
        const selectedTeamId = body?.selectedTeamId;
        const result = await validateAndStoreToken(label, {
          ...tokenPair,
          email,
          selectedTeamId,
        });
        const tokenPayload = decodeJwtPayload(tokenPair.accessToken);

        console.log("");
        console.log(`Login captured for '${label}'.`);
        console.log(`  email:        ${result.email}`);
        console.log(`  token sub:    ${shortenIdentity(tokenPayload?.sub)}`);
        console.log(`  team:         ${selectedTeamId ?? "(none)"}`);
        console.log(`  refresh:      HTTP ${result.refreshStatus}, shouldLogout=${String(result.shouldLogout)}`);
        console.log(`  snapshot:     ${accountPath(label)}`);
        console.log(`  full DB:      ${result.updatedFullDb ? accountFullDbDir(label) : "(none)"}`);
        console.log("");
        console.log(
          `Next: quit Cursor, then npm run spike -- switch ${label} --offline --full-db`,
        );
        return;
      }

      if (Date.now() - lastProgressAt > 15_000) {
        console.log(
          `  waiting... auth poll returned keys: ${Object.keys(body ?? {}).join(", ") || "(none)"}`,
        );
        lastProgressAt = Date.now();
      }
    } else if (response.status !== 404 && Date.now() - lastProgressAt > 15_000) {
      console.log(`  waiting... auth poll HTTP ${response.status}`);
      lastProgressAt = Date.now();
    }

    await sleep(500);
  }

  throw new Error("Timed out waiting for browser login");
}

function cmdSwitch(label, { offline, authOnly, fullDb }) {
  if (!offline) {
    throw new Error(
      "switch requires --offline. Quit Cursor (Cmd+Q), run switch, then reopen.",
    );
  }
  assertCursorState({ offline });

  const saved = loadSavedAccount(label);

  // Read live slice for backup (readonly). Writes happen in a separate connection.
  const readDb = openDb({ readonly: true });
  let live;
  try {
    live = readAuthSlice(readDb);
  } finally {
    readDb.close();
  }

  const liveEmail = live[`${AUTH_PREFIX}cachedEmail`];
  const targetEmail = saved.keys[`${AUTH_PREFIX}cachedEmail`];

  if (!fullDb && liveEmail === targetEmail) {
    console.log(`Already on ${targetEmail}. No changes written.`);
    return;
  }

  const backup = fullDb ? backupLiveFullSession(live) : backupLiveSlice(live);

  if (fullDb) {
    const fullState = restoreFullStateDb(label);
    if (fullState.restored) {
      console.log(`Restored full state DB from ${fullState.source} (${fullState.copied} files)`);
    } else {
      throw new Error(
        `No full DB snapshot for '${label}'. Re-save while signed in: npm run spike -- save ${label} --force --full-db`,
      );
    }
  } else {
    const writeDb = openDb({ readonly: false });
    try {
      writeAuthSlice(writeDb, saved.keys);
    } finally {
      writeDb.close();
    }
  }

  // Verify the write landed on disk.
  const verifyDb = openDb({ readonly: true });
  let writtenEmail;
  try {
    writtenEmail = readAuthSlice(verifyDb)[`${AUTH_PREFIX}cachedEmail`];
  } finally {
    verifyDb.close();
  }

  if (writtenEmail !== targetEmail) {
    throw new Error(
      `Write verification failed. Disk still shows ${writtenEmail ?? "?"}, expected ${targetEmail ?? "?"}.`,
    );
  }

  if (!authOnly) {
    const session = restoreSessionBundle(label);
    if (session.restored) {
      console.log(`Restored session bundle from ${session.source}`);
    } else {
      console.warn(
        `No session bundle for '${label}'. Re-save while signed in: npm run spike -- save ${label} --force`,
      );
    }
  }

  if (fullDb) {
    console.log(`Backed up live full session (${liveEmail ?? "?"}) → ${backup.dir}`);
  } else {
    console.log(`Backed up live slice (${liveEmail ?? "?"}) → ${backup}`);
  }
  console.log(`Applied ${fullDb ? "full DB" : "auth"} '${label}' (${targetEmail ?? "?"}) to state.vscdb`);
  console.log(`Verified on disk: ${writtenEmail}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Reopen Cursor");
  console.log("  2. Cmd+Shift+J → Cursor Settings → Account");
  console.log(`  3. Confirm email is ${targetEmail}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");
  const offline = argv.includes("--offline");
  const authOnly = argv.includes("--auth-only");
  const fullDb = argv.includes("--full-db");
  const openBrowser = argv.includes("--open-browser");
  const args = argv.filter(
    (a) =>
      a !== "--force" &&
      a !== "--offline" &&
      a !== "--auth-only" &&
      a !== "--full-db" &&
      a !== "--open-browser",
  );

  if (args.length === 0 || args[0] === "help" || args[0] === "--help") {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  ensureStore();

  const [command, label] = args;

  switch (command) {
    case "status":
      cmdStatus();
      break;
    case "list":
      cmdList();
      break;
    case "diagnose":
      cmdDiagnose();
      break;
    case "save":
      if (!label) throw new Error("save requires a label");
      cmdSave(label, force, { authOnly, fullDb });
      break;
    case "show":
      if (!label) throw new Error("show requires a label");
      cmdShow(label);
      break;
    case "refresh":
      if (!label) throw new Error("refresh requires a label");
      await cmdRefresh(label);
      break;
    case "login-link":
      if (!label) throw new Error("login-link requires a label");
      await cmdLoginLink(label, { openBrowser });
      break;
    case "switch":
      if (!label) throw new Error("switch requires a label");
      cmdSwitch(label, { offline, authOnly, fullDb });
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
