# OVERTAKE → Worldwide Hit Plan
*Audit & roadmap — 2026-11-07. Game audited: `overtake/` (Three.js + Vite + TS, ~8k lines). Legacy Spotify clone in `frontend/` + template FastAPI in `backend/` is unrelated scaffolding — archive it, don't build on it.*

## Decisions (2026-11-07)
- **Backend: Supabase** (chosen over Nakama — fastest to live leaderboards; Nakama remains the Phase 4 multiplayer option).
- **First build: UI redesign** ✅ done — see below.

### UI Redesign v1 — "Season 01: Every Pass Counts" (shipped)
- New design tokens in `src/style.css` (`--volt #d7ff3f` on near-black, italic 900 arcade type, 8–10px radii, panel top-accent) — layered as an override block so every existing ID/class and smoke-test selector is preserved.
- Garage hero ("EVERY PASS COUNTS"), Season hub (Daily Overtake + World Rankings cards), top-bar **World rankings** button, broadcast-style HUD score/combo, volt mode/contract/results accents.
- **World rankings dialog**: Global/Weekly/Daily/Friends tabs (latter three disabled until accounts), honest empty state + device best. Wired in `src/main.ts` (open/close/backdrop, focus return). No fake data.
- Next UI steps: extract tokens to `src/ui/tokens.css`, componentise modals/panels, motion pass.

### Phase 1+2 — shipped (2026-11-07)
- **Daily Overtake mode**: 90s, UTC `dailySeed()` (FNV-1a of YYYY-MM-DD) — same seed/contracts worldwide; `daily` local records + board. Unit-tested.
- **Weekly board** (`leaderboard_weekly`), **verified submission** (`submit_score` RPC: score/overtake/distance plausibility vs elapsed, sets `is_verified`), **cloud garage** (`profiles.cloud_save`, snapshot uploaded on game over).
- **Challenge links** (`?challenge=<seed>&mode=&score=`) + **share card** PNG (1200×630) with clipboard link on the results screen.
- **Live events**: `public/events.json` remote config → garage event banner (Launch Weekend / Daily Week / Endless Nights).
- **PWA**: manifest + icon + service worker (app-shell cache, Supabase never cached).
- **Website**: `website/` static landing + live Supabase leaderboard, deploy at `/`, game at `/play/`.
- ⚠️ Note: the first `overtake_rankings` migration was recorded during project restore but never applied — replaced by verified `overtake_full_rankings_v3` (tables confirmed via pg_tables).

### Phase 1 — Supabase LIVE (2026-11-07)
- Project `ezvavdcntqjzcxpjyfku` (eu-west-2) restored from pause; email auto-confirm ON (frictionless sign-up; turn OFF + custom SMTP before public launch).
- Migration `overtake_rankings` (repo copy: `supabase/migrations/20261107000000_rankings.sql`): `profiles` + `scores` tables, RLS (public read, insert-own only, plausibility CHECKs), `handle_new_user` trigger, `leaderboard(mode, limit)` RPC = best run per driver.
- Client `src/online.ts` (@supabase/supabase-js, publishable key only — no secrets in repo): sign-up/in/out, board fetch, auto-submit on game over (`seed` now flows through `RunStats` for future replay verification). Rankings dialog is fully wired (Endless/Rush/Daily boards); offline/signed-out = local records still save.
- Still to do: server-signed run tickets / replay anti-cheat (`is_verified` column ready), Weekly board, Daily Seed mode itself, set production Site URL + redirect allowlist in Supabase Auth once the website domain exists.

## 1. Honest audit: what you already have (better than you think)
| Asset | Status |
|---|---|
| Core loop | ✅ Strong: free-steering two-way overtaking, seeded runs (`mulberry32` in `src/run.mjs`), contracts, combos ×5, medals |
| Content | ✅ 7 cars + 2 NPC trucks, body workshop, paint/liveries/underglow, upgrades, 5 biomes, day/night, weather (rain/snow grip), procedural engine audio |
| Modes | ⚠️ Only 2: Endless, Rush (120 s) — `src/run.mjs: RUN_MODES` |
| Persistence | ❌ **Everything is `localStorage`** (`overtake-records-v2`, `overtake-progression-v2`, paints, customization). No accounts, no server, scores unverifiable |
| UI | ⚠️ One 598-line `style.css`, 142 element IDs in one `index.html`, Inter + Lucide, dark glass panels. Functional, generic — no brand identity, no motion design, no component system |
| Distribution | ❌ localhost Vite only. No PWA, no analytics, no error tracking, no website |
| Legal (CRITICAL) | ❌ README itself flags it: KrAZ licence unverified, several car models user-provided, real car names/trademarks (Ferrari, Mercedes…) not cleared. **You cannot monetise/scale worldwide until cars are renamed + licences verified or models replaced.** This is blocker #1 for a commercial launch |

**Positioning that can win:** *"The 60-second browser overtake game — one more run, beat the world today."* Don't fight Forza. Win on instant play (no download), daily competition, shareable near-miss clips.

## 2. UI redesign — GitHub repos to steal from (stars verified 2026-11-07)
**Key decision: do NOT rewrite the game in React Three Fiber.** Your imperative Three.js loop (2,048-line `game.ts`) works. Keep DOM UI (you already do this), rebuild it as a design system.

| Repo | ★ | Use it for |
|---|---|---|
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 127k MIT | Copy-in component patterns (dialogs, tabs, toasts, tables for leaderboards) — adapt to vanilla TS, don't adopt React just for this |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | 19k MIT | Accessible dialog/menu/slider behaviour + ARIA patterns for pause/settings/garage modals |
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 98k MIT | Replace hand-rolled 598-line CSS with tokens/utilities; you already use Tailwind in legacy frontend |
| [motiondivision/motion](https://github.com/motiondivision/motion) | 35k MIT | Menu transitions, score popups, medal reveals (vanilla JS API works without React) |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | 26k | Already used — keep, extend icon set consistently |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) + [pmndrs/uikit](https://github.com/pmndrs/postprocessing) | 3k | Already used for bloom; uikit only if you ever want in-3D UI — skip for now |
| [alexander-uspenskiy/CarRace](https://github.com/alexander-uspenskiy/CarRace) | small, MIT | **Study, don't copy:** broadcast-style racing HUD tower, Hall of Fame screen, marketing screenshot pipeline (`marketing/` 4K shots) |
| [storybookjs/storybook](https://github.com/storybookjs/storybook) | 91k MIT | Component catalogue once UI is componentised — garage/HUD/leaderboard states in isolation |

New UI direction: bold arcade identity (not "dark glass SaaS"), big condensed type, car-colour accent theming, animated garage turntable as hero, HUD = speed arc + combo fire + contract ticker only. Design tokens first (`--accent` per car), components second, screens third.

## 3. Global rankings — the architecture
Your seeded runs are the anti-cheat gift: same seed = same contracts/traffic RNG.
1. **Accounts + DB:** choose ONE (see §6): **Supabase** (fastest: Postgres + Auth + Realtime, 114k★) **or Nakama** (Heroic Labs, 13.6k★ Apache-2.0: leaderboards, tournaments, matchmaking, friends built-in — best long-term for multiplayer, more ops work). LEADR (leadr-oss) is purpose-built but tiny (5★) — too risky as core infra.
2. **Score submission:** server issues a signed run ticket (mode, seed, car, build version) → client submits summary (`runSummary()` already returns exactly the right shape) + event log → server rejects implausible scores (score/second, overtakes vs. distance, combo maths from `rules.mjs` — reuse the same pure `.mjs` modules server-side in Node, they're already framework-free and unit-tested).
3. **Boards:** Global all-time · Weekly season · **Daily Seed (everyone same seed — the viral board)** · per-car · per-mode · friends/"you ± 10". Redis sorted sets if self-hosting (that's what every OSS leaderboard does); Supabase = Postgres + materialised ranks.
4. Never trust the existing template `backend/server.py` (Mongo hello-world) for this.

## 4. New game modes (build in this order — reuse `RUN_MODES` + contracts)
1. **Daily Overtake** — one seed/day worldwide, 3 attempts, global board. *Highest retention per dev-hour.*
2. **Ghost Rival** — race the ghost (recorded inputs) of the player one rank above you. Async, no netcode.
3. **Elimination** — every 20 s, be above a rising score line or run ends.
4. **Slalom / Precision** — near-miss-only scoring, combo never resets but one touch = 0.
5. **Night Rush / Storm Rush** — forced weather/time variants of Rush (systems already exist!).
6. **Real-time multiplayer (last, hardest)** — Colyseus (7.5k★ MIT) or Nakama authoritative rooms, 4-player score race. Only after async modes prove retention.

## 5. Events & cosmetics (retention + revenue)
- **Events:** weekend tournaments (Nakama/ Supabase season boards), biome tours ("Desert Week"), contract marathons, creator codes, seasonal resets with badges. You need a remote-config file (JSON on CDN) so events don't need redeploys.
- **Cosmetics (you're 60% there):** workshop/paint/liveries/underglow already per-car in localStorage → sync to account, then add: wraps, plate text, wheel trails, horn/engine-note packs, finish animations, profile banners, garage themes. Sell a **season pass + cosmetic-only store — never pay-to-win** (upgrades stay earnable). Payment: Stripe; web-first avoids app-store 30% until you wrap for Steam/mobile (Capacitor/Tauri).

## 6. Website & distribution
- **Website:** Next.js (143k★) or Astro — landing (auto-playing gameplay capture, "Play now" = the game itself embedded), leaderboard pages (SEO: "best Overtake players today"), car/event pages, dev blog, press kit. Deploy game + site together (Vercel/Cloudflare Pages, CDN, PWA manifest + offline shell so it installs like an app).
- **Portals (where browser hits actually happen):** CrazyGames, Poki, itch.io, GameDistribution — SDKs add ads/revenue + millions of players. Then Steam (Tauri/Electron wrapper) once licences are clean.
- **Growth loop:** share-card image with score/rank/car (auto-generated canvas → X/Discord/TikTok), "challenge a friend" links carrying seed + ghost, Daily Seed streaks.

## 7. Connectors — what's actually on in THIS conversation
Only **two** connectors are enabled here (checked 2026-11-07):
| Connector | Status | Use it for |
|---|---|---|
| Google Docs | ✅ Enabled | This plan lives there too — PRDs, UI design brief, event calendar, patch notes. Named ranges = fill-in templates for weekly event docs |
| Google Drive | ✅ Enabled | Asset pipeline: car models/textures, marketing screenshots, press kit, shared playtest builds; comments = feedback on screenshots/builds |

Everything else is **off/not connected in this conversation** — I can't use it until you turn it on. Recommended next, in order: **GitHub** (issues/projects for this roadmap — though I already have git/gh in the sandbox), **Discord** (community is non-negotiable for a hit game; no connector verified yet — use webhooks), analytics/error tools aren't connectors here — wire **PostHog** (40k★, funnels/retention) + **Sentry** directly into the game code instead. Don't claim Notion/Slack/etc. until enabled in the Arena connector panel.

## 8. Roadmap
- **Phase 0 (wks 1–2):** licence/name audit, archive legacy Spotify code, design tokens + UI kit, PWA + analytics + Sentry.
- **Phase 1 (wks 3–6):** accounts + Supabase/Nakama, signed score submission, Global + Weekly boards, UI redesign (garage/HUD/results).
- **Phase 2 (wks 7–10):** Daily Seed + challenge links + share cards, Ghost Rival, Elimination, website launch, portal submissions (CrazyGames/itch).
- **Phase 3 (wks 11–16):** seasons/events engine, cosmetics store + season pass, Storm/Night modes.
- **Phase 4:** real-time multiplayer, Steam/mobile wrap.

*Rule for every phase: the pure `.mjs` rule modules + `npm test` stay the single source of truth — client and server run the same scoring code.*
