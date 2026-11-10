#!/usr/bin/env node
/**
 * Keep the web dashboard in step with the mobile app (../gurukul).
 *
 *   npm run sync:check   what is out of step, and every app change since the
 *                        last sync (exits 1 if a shared file has drifted)
 *   npm run sync:pull    copy the SHARED files from the app, word for word
 *   npm run sync:mark    record the app's current commit as "synced up to here"
 *
 * Three kinds of file:
 *   SHARED  identical in both repos. Never edit them here: change them in the
 *           app and pull. Web-only code lives in its own file next to them.
 *   WATCH   the same job done differently (browser APIs, the web's cache).
 *           Kept by hand; the check lists app commits that touched them.
 *   UI      app screens and components. Rebuilt by hand with the dashboard's
 *           own components; the check lists app commits that touched them.
 *
 * The app folder defaults to ../gurukul; set GURUKUL_DIR to point elsewhere.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = resolve(process.env.GURUKUL_DIR || join(WEB, "..", "gurukul"));
const MARK = join(WEB, ".app-sync.json");

export const SHARED = [
  "src/domain/alerts.js",
  "src/domain/classGroups.js",
  "src/domain/duties.js",
  "src/domain/houses.js",
  "src/domain/roles.js",
  "src/lib/classRecords.js",
  "src/lib/duties.js",
  "src/lib/errors.js",
  "src/lib/notifications.js",
  "src/lib/reportData.js",
  "src/lib/reportHtml.js",
  "src/lib/roster.js",
  "src/lib/statusBoard.js",
  "src/lib/students.js",
  "src/utils/format.js",
];

export const WATCH = [
  "src/lib/access.js",
  "src/lib/alerts.js",
  "src/lib/audit.js",
  "src/lib/avatars.js",
  "src/lib/clock.js",
  "src/lib/haptics.js",
  "src/lib/history.js",
  "src/lib/holidays.js",
  "src/lib/leave.js",
  "src/lib/passwords.js",
  "src/lib/report.js",
  "src/lib/staff.js",
  "src/lib/studentHistory.js",
  "src/lib/supabase.js",
  "src/context",
  "src/data",
];

export const UI = ["src/screens", "src/components", "src/navigation", "App.js"];
const SCHEMA = ["supabase/migrations"];
const NOTES = ["docs"];

const text = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const git = (...args) => execFileSync("git", ["-C", APP, ...args], { encoding: "utf8" }).trim();
const readMark = () => (existsSync(MARK) ? JSON.parse(readFileSync(MARK, "utf8")) : null);

function since(mark, paths) {
  if (!mark?.commit) return [];
  const out = git("log", "--format=%h %ad %s", "--date=short", `${mark.commit}..HEAD`, "--", ...paths);
  return out ? out.split("\n") : [];
}

function changedFiles(mark, paths) {
  if (!mark?.commit) return [];
  const out = git("diff", "--name-status", `${mark.commit}..HEAD`, "--", ...paths);
  return out ? out.split("\n") : [];
}

function drift() {
  return SHARED.map((f) => {
    const a = join(APP, f);
    const w = join(WEB, f);
    if (!existsSync(a)) return { f, state: "gone from app" };
    if (!existsSync(w)) return { f, state: "missing here" };
    return { f, state: text(a) === text(w) ? "same" : "differs" };
  });
}

function check() {
  const mark = readMark();
  const head = git("rev-parse", "--short", "HEAD");
  const dirty = git("status", "--porcelain", "--", "src", "supabase", "App.js");
  console.log(`App: ${APP}`);
  console.log(`App HEAD ${head}${dirty ? "  (uncommitted app changes — not counted below)" : ""}`);
  console.log(mark ? `Last synced: ${mark.commit} on ${mark.date}` : "Last synced: never (run sync:mark once caught up)");

  const rows = drift();
  const bad = rows.filter((r) => r.state !== "same");
  console.log(`\nSHARED files: ${rows.length - bad.length}/${rows.length} identical`);
  bad.forEach((r) => console.log(`  ✗ ${r.f} — ${r.state}`));
  if (bad.length) console.log("  → npm run sync:pull to copy the app's versions (then build)");

  if (mark?.commit && mark.commit !== head) {
    const section = (title, paths, hint) => {
      const files = changedFiles(mark, paths);
      if (!files.length) return;
      console.log(`\n${title} changed since ${mark.commit}${hint ? ` — ${hint}` : ""}:`);
      files.forEach((l) => console.log(`  ${l}`));
    };
    console.log(`\nApp commits since ${mark.commit}:`);
    since(mark, ["."]).forEach((l) => console.log(`  ${l}`));
    section("WATCH files", WATCH, "port the change by hand, keeping the web's version");
    section("UI", UI, "rebuild in the dashboard");
    section("Migrations", SCHEMA, "nothing to run here; the UI may need the new tables or RPCs");
    section("Notes", NOTES, "read for what to repeat on the web");
  } else if (mark?.commit) {
    console.log("\nNo app commits since the last sync.");
  }
  return bad.length ? 1 : 0;
}

function pull() {
  let n = 0;
  for (const { f, state } of drift()) {
    if (state === "same" || state === "gone from app") {
      if (state === "gone from app") console.log(`  ? ${f} is no longer in the app — remove it from SHARED if intended`);
      continue;
    }
    mkdirSync(dirname(join(WEB, f)), { recursive: true });
    writeFileSync(join(WEB, f), readFileSync(join(APP, f)));
    console.log(`  ↓ ${f} (${state})`);
    n += 1;
  }
  console.log(n ? `\nCopied ${n} file(s). Run the build, then review with git diff.` : "SHARED files already identical.");
  return 0;
}

function mark() {
  const commit = git("rev-parse", "--short", "HEAD");
  const date = new Date().toISOString().slice(0, 10);
  writeFileSync(MARK, `${JSON.stringify({ commit, date }, null, 2)}\n`);
  console.log(`Marked synced to app ${commit} (${date}). Commit .app-sync.json with the port.`);
  return 0;
}

if (!existsSync(join(APP, "src"))) {
  console.error(`No app found at ${APP}. Set GURUKUL_DIR to the gurukul folder.`);
  process.exit(2);
}
const cmd = process.argv[2] || "check";
const run = { check, pull, mark }[cmd];
if (!run) {
  console.error("Usage: node scripts/sync-app.mjs [check|pull|mark]");
  process.exit(2);
}
process.exit(run());
