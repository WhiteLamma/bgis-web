# Web dashboard ↔ mobile app parity

The mobile app (`../gurukul`, Expo) owns the database and ships features first.
This file is where the web dashboard records how far behind it is. Update it
whenever a feature is ported or a new app change lands.

Reviewed up to the app commit in `.app-sync.json` (now `1b6bfc2`, 2026-11-10):
every app change up to there is either ported or listed as a gap below.
To catch up, run `/sync-app` (or follow `.claude/skills/sync-app/SKILL.md`).

## 1. Screens and features

| App screen / feature | Web | Gap |
|---|---|---|
| Login, Pending (waiting for approval) | ✅ | — |
| Register (self sign-up, `RegisterScreen`) | ❌ | Web "Request access" only says "contact the office" |
| Forgot password → redeem reset code (036) | ❌ | Web "Forgot password?" only says "ask the office"; codes issued on web can only be redeemed in the app |
| Choose your password (048) | ✅ | — |
| Dashboard | ✅ | — |
| Duties list, Duty marking | ✅ | Upstream web has YDIV, mark all, remarks (040–042) |
| Gate desk + teacher sign-out from register (039, 047) | ✅ | — |
| Notifications inbox (047) | ✅ | — |
| Holidays | ✅ | — |
| School timetable (043) | ✅ | Web "Timings" page |
| Activity | ✅ | — |
| Records / ClassDay (class teacher's day view) | ⚠️ | Web has Students + Reports, not the ClassDay screen |
| Account: change own password | ❌ | App `changeOwnPassword` in `lib/passwords.js` |
| Roster → Staff: add with login, temp passwords, reset code (048) | ✅ | — |
| Roster → Staff: deactivate / reactivate, former staff (036) | ❌ | `set_staff_active`, `list_inactive_staff` |
| Roster → Students: add a student (037) | ✅ | — |
| Checkpoints: add / switch off checkpoints, defaults (036, 038) | ❌ | `CheckpointsScreen`, `lib/roster.js`, `canManageRoster` |
| Group editor: recurring groups, hand-picked members, several classes (036, 046) | ❌ | `GroupEditorScreen` |
| Coordinator trial-window checks | ❓ | Check app commit `54f7968` |
| Student display names (`displayName`) | ❌ | App commit `747db67` |
| Duty reminders / phone notifications | n/a | Phone only |

## 2. Shared rule and data files

The lists live in `scripts/sync-app.mjs`; `npm run sync:check` reports drift.

- **SHARED — identical to the app, never edited here** (`npm run sync:pull`):
  `domain/alerts, classGroups, duties, houses, roles`,
  `lib/classRecords, duties, errors, notifications, reportData, reportHtml, roster, statusBoard, students`,
  `utils/format`. Web-only code goes in its own file (e.g. `lib/attendanceBatch.js`).
- **WATCH — same job, web version kept by hand** (the web's cache, browser APIs):
  `lib/access, alerts, audit, avatars, clock, haptics, history, holidays, leave, passwords, report, staff, studentHistory, supabase`, and `context/`.
- **Web only:** `domain/nav.js`, `domain/status.js`, `lib/cache.js`, `lib/clipboard.js`, `lib/drafts.js`, `lib/timings.js`, `lib/attendanceBatch.js`.

Fixed on 2026-11-10 by the first `sync:pull`: hand-picked groups now resolve
to the right children (`resolveGroup`, migration 036/046), and the database's
plain-English refusals reach the user (`isExplained` in `errors.js`).

## 3. How to port an app change

Run `/sync-app`. In short: pull both repos → `npm run sync:check` →
`npm run sync:pull` → port WATCH and UI changes by hand → build → update this
map → `npm run sync:mark`.
