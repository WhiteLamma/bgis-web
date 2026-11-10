---
name: sync-app
description: Bring the web dashboard up to date with the mobile app (../gurukul) — copy shared rule/data files, port new app features to the web, and update the parity map. Use when the user says the app is ahead, asks to sync, catch up, or port app changes to the web.
---

# Sync the web dashboard with the mobile app

The Expo app in `../gurukul` ships features first and owns the database. This
repo follows it. Three tools keep them in step:

- `scripts/sync-app.mjs` — `npm run sync:check | sync:pull | sync:mark`
- `.app-sync.json` — the app commit the web was last reviewed against
- `docs/app-parity.md` — every app feature and its web state

## Steps

1. **Pull both repos first.** In this repo and in `../gurukul`: `git status`
   (stop and tell the user about uncommitted work), then `git pull --ff-only`.
   If this repo has local changes, stash or commit them before pulling.

2. **See what changed.** `npm run sync:check`. It prints:
   - SHARED files that differ from the app,
   - every app commit since `.app-sync.json`,
   - which WATCH files, UI files, migrations and notes those commits touched.
   Also read any new `../gurukul/docs/changes-*.txt` — they are written as
   instructions for the web.

3. **Shared files.** `npm run sync:pull` copies them word for word. Never
   hand-edit a SHARED file here: if the web needs extra code, put it in its own
   file (like `src/lib/attendanceBatch.js`). Run `npx next build`; if a page
   breaks, fix the page, not the shared file.

4. **WATCH files** (web-adapted copies: caching, browser APIs). Port the app's
   change by hand, keeping the web's caching and `invalidate()` calls.

5. **UI.** For each app screen or component change, build the web version with
   the dashboard's own pieces (`components/dash/ui.jsx`, `<dialog className="dlg">`,
   `PageHead`, `useFeedback`). Mirror the app's wording and rules. New pages go
   in `src/domain/nav.js`.

6. **Migrations** need nothing here — both apps use the same Supabase project.
   Note any RPC or table a web feature now depends on.

7. **Verify.** `npx next build` must pass; check changed pages in the preview
   (sign-in is the user's to do).

8. **Record.** Update `docs/app-parity.md` (move ported rows to ✅, add new app
   features as ❌ if not ported this time), then `npm run sync:mark`. Marking
   means "every app change up to this commit is either ported or listed as a
   gap in the parity map" — never mark without updating the map.

9. Tell the user what was ported, what is still a gap, and that nothing is
   committed unless they asked.
