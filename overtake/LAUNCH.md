# Launch and service setup

## What's available today

The landing site is `/`; the game is `/play.html`. Play, progression, cosmetics,
events and records work without an account and live in the browser's localStorage.
Daily/weekly objective selection rotates in UTC; ranked circuit races against AI award local
rank points and original automotive badges. Cars and world settings can vary,
and all results are local. Local ranks can be edited or losses
avoided by closing the browser, and are not evidence of competitive play. Results are **not verified** or global.
Sharing uses the native share sheet or clipboard, with a selectable-text fallback.
Players can also download an unverified result card as a PNG.
Developer-option runs are excluded from new personal records. Older personal
records cannot be retrospectively verified. The website's Account dialog also
provides an offline JSON export/import without sign-in. Import replaces local
garage data and records after confirmation and keeps one local undo backup; close
game tabs first. The file is unencrypted and contains user-controlled game data.

Optional email-link sign-in and manual cloud save/restore are connected for the
current development preview, but **not deployed or end-to-end verified yet**.
Signed-in players can explicitly upload or restore their garage, cosmetics, selected car, local
rank and personal records. There is no automatic sync or merging. Device settings stay
local; developer access is not transferred. Saves and scores are unverified and
cannot be used for competitive rankings. The profile migration is not used by the
app; there is no leaderboard or score-submission endpoint.

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

- The development preview uses the dedicated free-tier project `overtake-accounts`
  (Frankfurt, project ref `laaevrtphnqnhpkyyugc`). The previous project and its
  pre-existing `profiles` and `scores` tables were not changed. Its profile and
  score policies are public/unverified and should be reviewed independently.
- The dedicated project currently uses Supabase's default email service, which
  only sends to pre-authorized organization team addresses and is rate-limited.
  Configure a custom SMTP provider in the Supabase dashboard before public signups;
  never put SMTP credentials in Git, frontend variables, or chat. Verify delivery.
- The preview redirect allowlist contains the current exact Arena preview URL
  and local development URL. Preview hosts can change; add the new exact origin
  when needed. Production has no URL configured yet. Before deployment, set the
  site URL and exact redirect for the intended domain, and use a separate project
  for production if isolation is needed.
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
- For manual cloud saves, review and apply
  `supabase/migrations/20261108131824_overtake_cloud_saves.sql` to other approved
  projects as appropriate. It is already applied to `overtake-accounts`. It
  creates a separate table with
  per-user RLS, a payload size limit, server-controlled save ID/revision and restricted
  columns. Owners can read/write/delete only their own snapshots. A cloud snapshot
  remains user-controlled and is never evidence of fair play. The profile migration
  is not required for cloud saves. Back up and check for name collisions first.
- Close other Overtake game tabs before a save/restore, since active tabs can hold
  older data in memory. Upload replaces the account's previous snapshot after
  confirmation; conflicting save IDs or revisions are rejected. Restore replaces this device's
  listed game data after confirmation and keeps one local undo backup. The undo
  button swaps with that backup; making another restore replaces it. Browser storage
  limits or clearing site data can remove local data/backups. Downloads and restores
  do not automatically update any open game tab. Snapshot data is stored in Supabase,
  not end-to-end encrypted; do not treat it as secret.
- Database isolation is tested with embedded PostgreSQL, and the UI with mocked
  Supabase requests. The live project's policy configuration was inspected, but
  real sign-in, delivery and cross-account save tests are still required. Before
  release, test email delivery, RLS with real users, save/restore/delete, concurrent
  devices, backup failure and account switching.
- The older optional profile migration has not been applied to this project. Do
  not blindly run all migrations against an existing project; reconcile migration
  history and explicitly decide whether any optional migrations are needed.
- Configure abuse protections and email rate limits. Add privacy, retention,
  account-deletion, support and consent policies appropriate to the audience.
  Profile and cloud-save rows cascade on auth user deletion, but an account-deletion UI and
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
