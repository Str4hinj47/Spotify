# Circuit multiplayer: proposed implementation

The current circuit is an **offline race against AI**. No online racing,
accounts, matchmaking, server verification or network rewards are implemented.
The circuit and the highway modes are separate; the highway remains available.

## Recommended first online release

1. Private 2–6 player rooms with an invite code, one region, a ready screen,
   one circuit, a countdown, final standings, disconnect/reconnect and a
   timeout. AI can fill empty slots later. Start with unranked races.
2. Run a long-lived, authoritative WebSocket race server in a regional
   container/process host. Vercel can serve the frontend but its normal
   short-lived serverless functions are not a persistent simulation server.
   Local development uses a relative `/race` WebSocket endpoint proxied to the
   local race service; the browser must not connect to its own localhost.
3. Clients send sequenced control inputs, not claimed positions or results.
   The server runs fixed-step physics and collision/lap rules, validates car
   eligibility and finishes, and broadcasts timestamped snapshots. Clients
   predict their own car, reconcile corrections, and interpolate other cars.
   Start around 20–30 snapshots/second and measure latency, bandwidth and cost.
4. Share pure physics and track definitions between client and server, with
   a pinned simulation/version and deterministic test fixtures. Add swept
   collisions, wall/contact response, proper race start and finish timestamps,
   anti-shortcut checkpoints, tie handling and network fault tests before
   enabling competitive or reward-bearing play. The current AI contact and
   finish rules are a prototype, not a secure multiplayer simulation.
5. Supabase Auth can identify players; a server-only service can verify the
   player session and read/write a separate, scoped race schema with RLS and
   idempotent results. Do not trust localStorage balances or expose service-role
   keys in the client. Do not overwrite the existing unrelated project tables.
   Currency and purchases must move to a server-authoritative transaction ledger
   before any competitive rewards or payments. Local saves need an explicit,
   abuse-resistant migration policy; they cannot simply be trusted as online
   entitlements.
6. Add public matchmaking, regional queues, moderation/reporting, rate limits,
   monitoring, abuse prevention, accessibility, privacy and a reconnect policy
   only after private-room testing. Benchmark on slow devices and high latency.
   Publish ranked play only after results and progression are server verified.

## Decisions before implementation

Choose target regions, expected concurrent rooms, hosting budget, account/login
method, whether car upgrades affect online races, and a migration policy for
existing local progress. The chosen car models and uploaded wheel assets also
need confirmed multiplayer/commercial licensing before a public release.
