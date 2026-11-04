# OVERTAKE — Endless Highway

A browser-based, free-steering two-way overtaking game built with Three.js.
Pick one of five user-provided cars; the other four become traffic.

## Run

```bash
cd overtake
npm install
npm run dev      # http://localhost:3000
npm run build    # production bundle in dist/
npm test         # gameplay rule unit tests
```

## Controls

| Input | Action |
| --- | --- |
| `W` / `↑` | Throttle |
| `S` / `↓` | Brake |
| `A` / `←` and `D` / `→` | Steer (continuous, not lane-switching) |
| `Space` | Handbrake |
| `Shift` | Nitro boost (when charged) |
| `C` | Cycle camera presets |
| `V` | Camera settings |
| `B` | World settings (time / weather) |
| `R` | Toggle rear-view mirror |
| `P` / `Esc` | Pause |
| `M` | Mute |
| `Enter` | Start / retry |

Touch devices get on-screen steering, throttle and brake buttons.

## Gameplay

- **Run modes:** Endless (classic survival) and Rush (120-second score attack).
  Each mode keeps its own personal best and recent-run history in `localStorage`.
- **Contracts:** every run rolls three sequential objectives (overtakes, near
  misses, distance, oncoming dodges, combo, sustained speed). Completing one
  pays bonus points and nitro.
- **Earned nitro:** clean passes, near misses, oncoming dodges and slipstreaming
  charge the meter. Hold `Shift` (or the touch ⚡ button) with throttle to boost.
  Boost raises acceleration and the speed ceiling, then overspeed bleeds off
  smoothly. It never pitches the car or moves the camera.
- **Smarter traffic:** same-direction cars follow slower leaders and brake
  instead of stacking; brake glows show deceleration. A time-to-collision hazard
  radar warns about the nearest closing threat.
- **Driving feel:** wheels are split into pivots at load time, so the player car
  has rolling wheels and speed-sensitive front-wheel steering. The body still
  has no acceleration pitch.
- **Rear-view mirror:** a live rear-facing inset (`R` or the mirror button) helps
  you judge when to return to the right lane. It can be disabled and remembers
  the setting.
- **Pass coach:** an advisory pill estimates whether the current oncoming gap is
  long enough to complete an overtake. It never steers or brakes for you.
- Two lanes, **opposing directions**. Your lane is the right one; the left lane
  carries a dense stream of oncoming traffic. Pull out, overtake, and get back in.
- The road is procedurally generated ahead of you with bends and crests.
- Same-direction traffic is slower; oncoming traffic closes fast. Spawning keeps
  a visible overtaking window instead of creating unavoidable walls.
- Driving uses a road-relative vehicle model (`src/physics.mjs`): continuous
  speed-sensitive steering, grip-limited yaw, friction-circle throttle/brake,
  handbrake grip loss, and per-car wheelbase/grip/brake/drag values.
- Scoring: overtake +100, near-miss bonus +50, close oncoming dodge +75.
  Every 5 clean passes raises the combo multiplier (up to ×5). Car-specific
  score bonuses apply. Best score is stored in `localStorage`.
- Hitting traffic or the barrier ends the run.

## Cars

| Car | Source |
| --- | --- |
| Volkswagen Golf MK4 | `Volkswagen VW Golf MK4 - Cycles.zip` — Jay-Artist, CC BY 3.0 |
| Mercedes-Benz S 63 AMG (W222) | `MB.W222.AMG.blend` — user-provided |
| Audi RS 6 Avant | `Audi_RS_6_Avant_Not+Applied.blend` — user-provided |
| Ford Mustang GT | `Mustang.zip` — user-provided |
| Ferrari 458 Italia | `Ferrari 458 Italia.zip` — RainerS, CC BY 3.0 |

The original `.blend` files were converted to Draco-compressed glTF with
`tools/convert_assets.py` (requires Blender's `bpy` module). Geometry is
preserved; materials were rebuilt as lightweight PBR for real-time rendering.
Studio helpers, ground planes and light blockers were removed. Headlight and
taillight lenses are preserved and emissive; the Ferrari's source-mesh yaw is
corrected so it runs parallel to the road.

### Paint customization

The garage includes a paint panel for every car: ten swatches, a custom color
picker, and a **Factory** reset. Paint is saved per car in `localStorage`
(`overtake-paints`) and is applied to both the player car and traffic instances
of that model.

## World, weather and day–night

The background no longer swaps biomes abruptly. Roadside scenery is placed in
deterministic slots and cross-faded by distance through **meadow → forest →
alpine → desert → outskirts** using `simplex-noise` and smoothstep weights
(`src/world/biomes.mjs`). Ground, shoulder, mountain and fog colours blend with
the same weights.

A day–night clock (`src/world/clock.mjs`) drives the sky gradient, sun disc,
moon, stars, street lamps and player headlights. A full cycle takes 10 minutes
at 1×. The world panel lets you scrub time, change cycle speed, pause the cycle,
or force **Auto / Clear / Rain / Snow**.

Weather (`src/world/weather.mjs`) damps in/out instead of switching instantly.
Rain darkens and smooths the asphalt, thickens fog, and adds camera-following
rain streaks. Snow adds falling flakes, snow cover on ground/shoulders/trees,
and heavier fog. Both reduce tyre grip. The rain/snow particle approach is
adapted from [Elemental-Serenity](https://github.com/SahilK-027/Elemental-Serenity)
(MIT).

## Lighting and car paint

The old canvas-gradient environment map was replaced with a proper image-based
lighting pipeline:

- **Garage:** three.js's open-source
  [`RoomEnvironment`](https://github.com/mrdoob/three.js/blob/dev/examples/jsm/environments/RoomEnvironment.js)
  (MIT, based on Google model-viewer's studio scene) is prefiltered with
  `PMREMGenerator` and paired with rectangular softbox lights. This gives the
  clearcoat long, readable highlights instead of a flat grey sheen.
- **Road:** a small HDR sky environment is generated from the live atmosphere
  (sky colours, sun direction, weather and biome ground colour) and prefiltered
  the same way, so reflections match the time of day and weather.
- **Paint:** cars use a `MeshPhysicalMaterial` basecoat + clearcoat with moderate
  metalness, smoother clearcoat roughness, tuned glass/chrome/rim response, and
  head/tail lamps whose emissive strength follows night/weather instead of
  glowing permanently.
- **Tone mapping:** the HDR frame is tone-mapped with the Khronos PBR-neutral
  curve through [postprocessing](https://github.com/pmndrs/postprocessing),
  which preserves paint colour better than the previous ACES setup.

Rendering uses [three.js](https://github.com/mrdoob/three.js),
[maath](https://github.com/pmndrs/maath) for frame-rate-independent damping, and
[postprocessing](https://github.com/pmndrs/postprocessing) for
bloom/vignette/tone mapping. The cleaner UI uses
[Inter](https://github.com/rsms/inter) and
[Lucide](https://github.com/lucide-icons/lucide) icons. See
`THIRD_PARTY_NOTICES.md`.

## Engine audio

Engine sound is powered by [Engine_Sim](https://github.com/YigitSalihEmecen/Engine_Sim)
(MIT), vendored unmodified in `src/vendor/engine-sim`. It synthesizes firing
events, exhaust, gearbox and turbo live with Web Audio. Each car uses the
closest built-in engine architecture, then a per-car preset in
`src/engine-presets.ts` tunes redline, torque, inertia, exhaust, turbo and
vehicle mass/gearing toward the researched production engine:

| Car | Real engine | Engine_Sim base |
| --- | --- | --- |
| Golf MK4 GTI | 1.8T 20v turbo inline-4, 235 Nm @ 1950 rpm | `i4` + turbo |
| S 63 AMG (W222) | M157 5.5L V8 biturbo, 900 Nm | `v8tt`, deep/muffled |
| RS 6 Avant (C7) | 4.0 TFSI V8 biturbo, 700 Nm @ 1750 rpm | `v8tt`, sportier |
| Mustang GT | 5.0L Coyote NA cross-plane V8 | `v8cross` |
| Ferrari 458 Italia | 4.5L F136 flat-plane V8, 9000 rpm | `v8flat` |

The HUD shows RPM, gear and boost. Audio starts after the **Start engine** user
gesture, as required by browsers.

## Tests

```bash
npm test                     # scoring / spawn / physics / biome / weather / clock
node scripts/smoke.mjs       # headless browser playthrough (requires local server)
node scripts/world-shots.mjs # day/night/rain/snow/biome screenshots
node scripts/upgrade-smoke.mjs # Rush / contracts / nitro / records browser test
node scripts/driving-upgrade-smoke.mjs # wheels / mirror / pass coach browser test
node scripts/lighting-shots.mjs # garage / day / dusk / night / rain lighting shots
```
