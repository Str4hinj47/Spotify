# Launch and service setup

## What's available today

The landing site is `/`; the game is `/play.html`. Play, progression, cosmetics,
events and records work without an account and live in the browser's localStorage.
Daily/weekly objective selection rotates in UTC; traffic is random, world settings
and cars can vary, and the clock is local. Results are **not verified** or global.
Sharing uses the native share sheet or clipboard, with a selectable-text fallback.
Developer-option runs are excluded from new personal records. Older personal
records cannot be retrospectively verified.

An optional email-link sign-in UI exists on the website. It is disabled until
configured. Sign-in does not currently synchronize progress, use the profile
migration, submit scores, or create a leaderboard. Do not promise cross-device
saves or competitive rankings on the basis of this foundation.

## Vercel (when you create the project)

1. Import `Str4hinj47/Spotify`, set the **Root Directory** to `overtake`, use
   Vite, build command `npm run build`, and output directory `dist`.
2. The changes are on branch `arena/9badb010-spotify`. Configure the desired
   production branch and review preview versus production deployments. Importing
   a project can create a deployment immediately; check its visibility first.
3. For Supabase sign-in, add the public environment variables described below to
   the correct Vercel environment and redeploy. Keep production and preview
   projects, redirect URLs and data isolated as appropriate. Never add a service
   role key to a `VITE_` variable: Vite embeds those values in public JavaScript.
4. Check Vercel's current plan terms before commercial use; hosting and Supabase
   usage are separate costs. Load-test, monitor usage, and set budget alerts.

## Optional Supabase account foundation

- Do not apply changes to an existing project until its owner and purpose are
  confirmed and its schema is reviewed. The currently connected project has
  pre-existing `profiles` and `scores` tables; this repository has not changed
  them. Prefer a separate project for this game and another for previews.
- Configure Email Auth and delivery, site URL, and exact allowed redirect URLs
  in Supabase. The website sends links back to the site's root; add each intended
  HTTPS origin, plus a local development redirect if needed. Test email delivery,
  confirmation, expiry, sign-out and redirect restrictions before launch.
- Copy `.env.example` to `.env.local` for local use and set `VITE_SUPABASE_URL`
  and `VITE_SUPABASE_ANON_KEY` to the **public project URL and publishable key**
  (legacy anon key also supported). No secret or service-role key belongs there.
  Vercel needs the same variables in the appropriate environment. An invalid or
  missing configuration leaves the account button in its unavailable state.
- `supabase/migrations/20261107000000_overtake_profiles.sql` is an **optional**
  isolated profile foundation, not automatically applied. Review collisions,
  permissions, policies and backups before applying it in the intended project.
  It has owner-only RLS and grants only display-name changes; the application
  currently does not read or write it. No ranking or score-submission table is
  provided, deliberately. Test RLS as anonymous, another user and the owner.
- Configure abuse protections and email rate limits. Add privacy, retention,
  account-deletion, support and consent policies appropriate to the audience.
  The profile row cascades on auth user deletion, but an account-deletion UI and
  operational process have not been implemented.

## Before enabling global rankings

Client localStorage and submitted totals are untrusted; login, RLS, seeded
objectives, timestamp checks or a signature made in browser code do not verify
results. The current simulation uses random traffic and adjustable conditions.
A real competitive release needs a versioned, deterministic ruleset and a
controlled event configuration, server-issued event/run identifiers, input/replay
capture and independent authoritative simulation or replay validation, rejection
of invalid/out-of-bounds inputs, server-side result calculation, replay protection,
rate limiting, audit/anti-cheat workflows and load tests. Publish rankings only
from server-validated results; never give browsers permission to insert verified
scores or expose privileged credentials. If the simulation cannot be replayed
reliably across platforms, use an authoritative server rather than claiming it is
verified. Separate unranked/dev runs and historical local records entirely.

Before a public/commercial launch, independently verify model licenses and vehicle
trademark rights as described in `THIRD_PARTY_NOTICES.md`, and review accessibility,
mobile performance, crash reporting, privacy, compliance and operational costs.
