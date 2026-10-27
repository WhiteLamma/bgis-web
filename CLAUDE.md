@AGENTS.md

# BGIS Web Dashboard

A web dashboard for the Gurukul attendance & student-safety app. The mobile app
(Expo) lives in `C:\Users\Deepanshu\Desktop\gurukul` and owns the backend: this
dashboard reads and writes the **same Supabase project**, so its tables, views,
RLS policies and business rules are the source of truth here too.

## Reference copied from the gurukul app — `docs/gurukul/`

This is a snapshot taken on 2026-10-28. For anything that may have changed, read
the live files in `C:\Users\Deepanshu\Desktop\gurukul` instead.

| What | Where |
|---|---|
| Project rules, naming, roles, build order | `docs/gurukul/CLAUDE.md` |
| Code layering (data / rules / presentation) | `docs/gurukul/ARCHITECTURE.md` |
| Setup, running, schema notes | `docs/gurukul/README.md` |
| Requirements, data model, self-build guide | `docs/gurukul/reference/` |
| Real database schema, RLS, functions, views | `docs/gurukul/supabase/migrations/` |
| Business rules (pure JS, no React) | `docs/gurukul/domain/` — `dutyStatus`, `deriveAlerts`, roles, class groups |
| Knowledge graph of the whole app | `docs/gurukul/graph/` (git-ignored, local copy) — `GRAPH_REPORT.md`, `graph.json`, `graph.html`, `obsidian/` vault. Regenerate with `/graphify` in the gurukul repo |

## Environment

`.env.local` (git-ignored) points at the **mock** Supabase project, the same one
the app uses via `gurukul/.env.mock.local`. It holds only
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; `.env.example`
lists the names. The service-role key and database URL were deliberately not
copied: never give them a `NEXT_PUBLIC_` prefix, since Next.js ships those to
the browser.

## Rules carried over

- Never change the schema from this repo. Schema changes are migrations in the
  gurukul repo, so the app and the dashboard stay on one database shape.
- Use the Supabase **anon** key in the browser, never `service_role`. Access is
  enforced by the RLS policies in `supabase/migrations/002_rls_policies.sql` and later.
- Reuse the names already established (see `docs/gurukul/CLAUDE.md` §3): `duties`,
  `attendance`, `DUTY_STATUS`, `STATUS_META`, `SPANNING`, role names
  `teacher | coordinator | management | admin | nurse | reception`.
- Safety alerts are derived from attendance (`deriveAlerts` in `domain/alerts.js`),
  not stored. Port that logic rather than re-inventing it.
- Present is stored as no mark (null status), not a `P` row.
