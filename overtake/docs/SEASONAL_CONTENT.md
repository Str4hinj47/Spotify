# Seasonal content playbook

This is a source-controlled workflow for shipping new content in a game build,
not a remote CMS or automatic seasonal rotation. Players keep their cars,
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
patterns are `stripe` and `race`; variants reuse the same per-car fitted
geometry but can have different suggested colors and prices. A player can
change the color afterward. `fittedLabel: null` displays the supplied label;
`0` or `1` uses that car's existing custom label. `defaultColor: null` preserves
the player's current color when selecting it. The built-in **Sunset stripe**
is an example. These variants are not entirely new artwork; a genuinely new
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
4. Check garage selection, purchase, paint, every body part and livery, upgrades,
   driving, NPC traffic, thumbnails, desktop and mobile. Confirm new-car
   ownership and recent records survive a reload and backup/restore. Test
   low-end devices: all vehicle models are currently loaded at startup, so a
   growing fleet will eventually need lazy loading and memory budgeting.

## Release and save safety

1. Increment `CONTENT_REVISION` whenever adding a **persistent car or cosmetic
   ID**. Keep old entries and models. Pre-revision backups are still accepted.
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
