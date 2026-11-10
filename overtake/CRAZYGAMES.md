# CrazyGames launch and ads

OVERTAKE's CrazyGames build monetizes through the CrazyGames ad SDK only. No
other ad network, payment SDK, or portal branding is included.

## Status

- **IAP (real-money purchases) is not configured.** CrazyGames offers in-game
  purchases by invitation only, through Xsolla, and only to games that already
  perform well on ads. Do not plan revenue around it before an invite arrives.
- **Ads are the launch path.** Ads, banners, and IAP stay disabled during the
  **Basic Launch** review. They switch on after CrazyGames promotes the game to
  **Full Launch**; the same build can be used for both.
- Developer share (published 2026 jam terms): **60% of ad revenue**, 70% of IAP
  after recoup. Payouts are monthly through Tipalti with a **€100 minimum**, and
  payout onboarding requires tax/identity details even though players never pay
  you directly.

## Build

```bash
npm run build:crazygames
```

This writes `dist-crazygames/` with:

- `index.html` at the **root** (the game; the marketing page is not included),
- relative asset URLs (`./assets/...`, `./models/...`),
- the CrazyGames SDK v3 script in the head,
- **73 files, 34.9 MB** — inside the 50 MB initial / 250 MB total / 1,500 file limits.
- `portal-build-report.txt` with the measured size and file list summary.

Upload the **contents** of `dist-crazygames/` as a zip, or upload the prepared
`overtake-crazygames.zip` from the repository root. `index.html` must be at the
zip root.

## What is wired

| Placement | When | Type |
| --- | --- | --- |
| Results card → **Double rewards** | After a run with rewards, once per result | Rewarded |
| Season pass → **+3 gems** | Season pass screen, 10-minute cooldown | Rewarded |
| Season pass → banner | Season pass screen only, one responsive banner | Banner |
| **Drive again** after 2+ runs | Natural break between runs, 2-minute client guard | Midgame |

All video ads are requested through `window.CrazyGames.SDK.ad.requestAd()`.
Banners use `requestResponsiveBanner()` and are cleared when the season pass
closes. Ads start in the loading/menu/results flow, never during driving.

### Compliance details implemented

- `gameplayStart()` on the first driving frame and every resume;
  `gameplayStop()` on pause, results, garage, menus, and tab hide.
- Input is blocked with an ad curtain from the moment a video is requested until
  `adFinished`/`adError`; audio is muted on `adStarted` and restored afterwards.
- Any `adError` (unfilled, cooldown, adblock, disabled) continues the game, pays
  no reward, and re-enables the offer.
- Rewarded offers are optional, clearly labelled as ads, have a non-ad path
  (earn the same currencies from runs/quests), are never chained, and never
  appear during an active race or on navigation buttons.
- An adblocked player sees no dead ad buttons; the game is fully playable in
  Basic Launch and with all ads disabled.
- `SDK.game.settings.muteAudio` overrides the in-game sound toggle and is
  listened to for changes.
- No external links, payment flows, or third-party ad code exist in the portal
  build.

## QA

```bash
npm test                          # includes tests/ads.test.mjs
node scripts/ads-smoke.mjs        # mocked SDK, placements, mute, cooldown, layout
node scripts/racing-line-smoke.mjs# race results fit with the ad offer
node scripts/portal-smoke.mjs     # built CrazyGames output against a static server
```

`?ads=demo` simulates a rewarded video locally without an SDK. The service is
disabled automatically on hosts that are not `localhost`, a CrazyGames domain,
or the demo flag, so test ads never appear on the public Vercel site.
