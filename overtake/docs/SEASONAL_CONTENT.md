# Seasonal content playbook

This is a source-controlled workflow for shipping new content in a game build,
not a remote CMS or automatic rotation of purchasable content. The separate
in-game Seasonal Challenge rotates its local objective each UTC quarter. Players keep their cars,
purchases and equipped items when a season ends. Do **not** remove, rename or
reuse an ID, delete an owned car's model, or change what an existing livery ID
means. Add rather than replace. There is no expiry, timed store, entitlement
server or automatic update scheduler here.

## Where content lives

- `src/content/cars.mjs` is the single playable-car catalog. It supplies the
  car ID, display text, factory paint, stats/physics, price, model orientation
  and NPC cruise speed to the garage, progression, records, saves and traffic.
  The car ID also determines `public/models/<id>.glb`. `collection` is
  authoring metadata only; it does not schedule or hide a car.
- `src/content/cosmetics.mjs` holds paint swatches and livery options. Livery
  IDs, prices, renderer patterns and suggested colors drive the workshop,
  purchase, rendering and save validation. `collection` is metadata only.
- `src/content/version.mjs` contains the monotonically increasing content
  revision used in newly captured cloud/offline backups.
- `src/content/released-ids.json` is the append-only ledger of shipped car and
  livery IDs and livery patterns. Validation checks it against the catalog.

### Adding a paint swatch

Add `{ name: '...', hex: '#rrggbb' }` to `PAINT_COLORS`. It is a shortcut to
an arbitrary paint color, not an exclusive item: all colors still use the
existing one-time per-car paint price. Saved colors survive swatch removal;
there is no purchase per swatch.

### Adding a livery variant

Add an entry to `LIVERY_OPTIONS`, for example:

```js
{ id:'midnight-stripe', label:'Midnight stripe', fittedLabel:null,
  pattern:'stripe', price:600, defaultColor:'#6688cc', collection:'Night Run' },
```

Use a unique stable lowercase ID with letters, digits and hyphens. The existing
patterns are `stripe`, `race`, `center`, `sprint`, `velocity`, `heritage`, `apex` and `flames`; variants reuse the same per-car fitted
geometry but can have different suggested colors and prices. A player can
change the color afterward. `fittedLabel: null` displays the supplied label;
`0` or `1` uses that car's existing custom label. `defaultColor: null` preserves
the player's current color when selecting it. The built-in **Sunset stripe** uses the single-center-stripe pattern. These variants are not entirely new artwork; a genuinely new
pattern needs renderer/shader work in `src/livery.ts`, a corresponding validator
update and visual tests on every car. New body parts, finishes, lighting types,
or texture-based decals also require code and migration work; adding a line to
this list alone does not implement them.

The local economy stores paid options as `livery:<id>` per car. Existing IDs
`none`, `stripe`, and `race` must retain their meanings. Avoid price changes
that make ownership ambiguous; already purchased options remain owned. Current
saves retain up to 256 purchased tune tokens per car; revisit that cap and the
100 KB cloud snapshot limit before a very large catalog.

### Adding a playable car

1. Obtain and document model, texture and vehicle/trademark rights. Preserve
   source files and update `THIRD_PARTY_NOTICES.md`; verify commercial rights
   independently. Prepare a normalized, Draco-compatible GLB with identifiable
   `paint__` and `tire__` materials. Place it at `public/models/<id>.glb`, and
   add an entry with matching `id` and `file` in `public/models/manifest.json`.
   Check triangle counts, textures, glass, wheel scale, load time and memory.
2. Add a unique entry in `src/content/cars.mjs`; copy an existing entry as a
   template. Speeds are in m/s, acceleration in m/s², orientation in degrees;
   the nose must point toward -Z after orientation. Review handling, score bonus,
   price and traffic speed together; `collection` is descriptive, not a switch.
3. A new model is **not** plug-and-play: author and visually check the required
   per-car data in `src/body-kits.ts` (`BODY_FITS`), `src/sill-profiles.json`,
   `src/livery.ts` (`LIVERIES`), `src/engine-presets.ts`, `src/indicators.ts`
   (front and rear), `src/vehicle-lights.ts` and `src/wheels.ts` (`WHEEL_RULES`).
   These depend on the actual mesh/material names and measured geometry. Build
   errors identify missing typed profiles; the sill measurements can be sampled
   with `tools/measure_sill_profiles.mjs CAR_ID FRONT_Z REAR_Z` while Vite is
   running (set `GAME_URL` to its origin). Merge the resulting entry into the
   JSON rather than overwriting existing profiles. Check wheel pivots and body
   clipping, indicators, brake/rear lamps, exhaust, liveries and audio by hand.
   Cars without reviewed bodywork can declare `bodywork: false` and omit both
   BODY_FITS and sill profiles; the workshop disables bodywork for them.
4. Check garage selection, purchase, paint, every body part and livery, upgrades,
   driving, NPC traffic, thumbnails, desktop and mobile. Confirm new-car
   ownership and recent records survive a reload and backup/restore. Test
   low-end devices: all vehicle models are currently loaded at startup, so a
   growing fleet will eventually need lazy loading and memory budgeting.

## Release and save safety

1. Increment `CONTENT_REVISION` whenever adding a **persistent car or cosmetic
   ID**, add the new IDs/patterns to `released-ids.json` and set its revision
   to match. Never delete or overwrite old ledger entries. Keep old entries and models. Pre-revision backups are still accepted.
   Revision-aware builds reject backups from a *newer* revision rather than
   silently dropping its content. This is not a universal rollback guarantee:
   builds released before revision checks cannot enforce it, and open old game
   tabs may still hold stale in-memory saves. Close all old tabs, update/reload
   to the latest build and export a local backup before updating or restoring.
   Do not restore a newer save in an older build. Real cloud syncing remains
   optional, manual and unconfigured until set up; it is not anti-cheat.
2. Run:

   ```bash
   npm run validate:content  # IDs, data, GLB headers/manifest, sill profiles, TS profiles
   npm test                  # includes real GLB parsing and compatibility checks
   npm run build
   npm run dev
   BASE_URL=http://localhost:3000 node scripts/content-smoke.mjs
   BASE_URL=http://localhost:3000 node scripts/menu-smoke.mjs
   BASE_URL=http://localhost:3000 node scripts/new-content-smoke.mjs
   ```

   Run `scripts/progression-smoke.mjs`, `scripts/showroom-graphics-smoke.mjs`
   and the workshop/ranked smokes when those areas change. Automated validation
   cannot judge fit, clipping, sound, vehicle rights, balance or performance;
   inspect and play-test the content. The Playwright scripts need a compatible
   Chromium environment as described by the repository setup.
3. Deploy a new Vite build using the normal release process; content isn't
   fetched dynamically. On rollback, preserve newer users' save data and have
   them update back to a compatible version before restoring. Test backups and
   exports across versions in a staging environment before release.

### Local economy and optional premium track

Coins and credits are separately earned from the same run-score payout, and are
spent only on performance upgrades and cars respectively. Quests give 5 gems
(10 in Seasonal Challenge), including after the XP track is complete; gems buy
cosmetics or the 50-gem seasonal premium track. The free track remains usable
without spending. Premium awards only cosmetic items, including retroactive tiers,
never cars, upgrades, boosts or extra XP. Premium access and XP reset at the UTC
quarter boundary; granted items remain owned. The current reward tracks repeat.
Legacy money is migrated once to the same number of coins and credits plus one gem
per 50 old money (rounded up); owned cars, parts and upgrades are retained.

**There is no real-money checkout.** All balances and pass state are local and
unverified. Do not accept real payments or advertise purchased entitlements until a
server-authoritative wallet and entitlement ledger, a payment provider with
verified webhooks/idempotency, fraud/refund handling, account recovery, regional
price disclosure and applicable consumer protections are in place. Do not allow
paid gems to convert to coins or credits, or premium rewards to grant performance.

### Car rarity and unlock order

The showroom is ordered from lower to higher **game performance rarity**, not
real-world production scarcity or market value. A player spends credits to
unlock one car from every lower numbered tier before buying a higher tier.
The game-ready Aventador is the tier-10 car. The detailed Aventador and Chiron
are retired; their IDs and old run records remain valid in saves. Owners of the
detailed Aventador receive the surviving version with their upgrades and tunes,
and Chiron owners receive a one-time credit refund. Other owned cars, upgrades
and cosmetics are kept even if an older save has gaps. A gap must be filled before a new higher-tier buy,
but an already-owned car can still be driven. Dev preview doesn't bypass the
purchase order. The Camry, 560 SEL and Range Rover are traffic-only and are not in the unlock path.

The coarse ordering is an estimate, not an exact comparison: the models don't all
specify year, engine or trim. It draws on representative 2003 GTI 1.8T,
Challenger R/T, R34 GT-R, Mustang GT, an E92-based race M3, RS 6, S 63,
R8 V10, 458 Italia and LP 700-4 Aventador. Acceleration, top speed and the race
car's track capability all influence placement; close entries can overlap.
In-game speeds and acceleration are deliberately scaled to the game, not exact
manufacturer specifications. Examples of reference figures:

- [2003 GTI 1.8T](https://www.carspecs.us/cars/2003/volkswagen/golf-gti/42078),
  [Challenger R/T](https://www.motortrend.com/cars/dodge/challenger),
  [R34 GT-R](https://www.hotcars.com/2000-2002-nissan-skyline-r34-costs-facts-and-figures/),
  [Mustang GT](https://www.edmunds.com/ford/mustang/2023/).
- [E92 M3 GT2 race car](https://www.sportscar2.com/sports-car-bmw-m3-e92-gt2.html)
  is a proxy, not a verified exact match for the M3 GT3 asset;
  [RS 6](https://media.audiusa.com/releases/395),
  [S 63](https://media.mbusa.com/releases/release-f952d79985063c97cd7417b80f0ec079-2018-mercedes-amg-s63-sedan-specifications),
  [R8 V10](https://www.caranddriver.com/reviews/a15130900/2011-audi-r8-spyder-52-v10-fsi-quattro-review/),
  [458 Italia](https://www.automobile-catalog.com/performance/2011/1227470/ferrari_458_italia.html),
  [Aventador LP 700-4](https://www.guideautoweb.com/en/makes/lamborghini/aventador/2012/specifications/lp-700-4/).
