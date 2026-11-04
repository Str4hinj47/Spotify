# OVERTAKE — Endless Highway

A browser-based, free-steering two-way overtaking game built with Three.js.
Pick one of seven cars; the other models become traffic.

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
| Audi R8 | `r8.obj` — user-provided |
| Dodge Challenger | `Challenger.obj` — user-provided |

The original `.blend` files were converted to Draco-compressed glTF with
`tools/convert_assets.py` (requires Blender's `bpy` module). Geometry is
preserved; materials were rebuilt as lightweight PBR for real-time rendering.
Studio helpers, ground planes and light blockers were removed. Headlight and
taillight lenses are preserved and emissive; the Ferrari's source-mesh yaw is
corrected so it runs parallel to the road. Its detached studio artifact was removed and its front wheels straightened. The two OBJ assets use `tools/convert_obj.mjs` to rebuild materials, selectively simplify and Draco-compress the geometry while retaining body panel detail; `tools/fix_ferrari.mjs` documents the Ferrari correction. `tools/repair_paint_normals.mjs` regenerates creased body normals on the Audi RS 6, Mustang and Ferrari without changing their geometry, to reduce triangular highlights.

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
The road uses ambientCG asphalt and gravel colour/normal maps and weathered painted markings. Rain darkens it and creates irregular reflective puddles with animated raindrop ripples, thickens fog, and adds camera-following rain streaks. Snow adds falling flakes and a separately raised, textured layer with uneven snow banks and exposed tire tracks, as well as snow on the ground/shoulders/trees and heavier fog. Road textures and snow patterns stay anchored to road distance as you drive. Both reduce tyre grip, acceleration and braking traction while the surface gradually accumulates and clears. The rain/snow particle approach is
adapted from [Elemental-Serenity](https://github.com/SahilK-027/Elemental-Serenity)
(MIT).

Rendering uses [three.js](https://github.com/mrdoob/three.js),
[maath](https://github.com/pmndrs/maath) for frame-rate-independent damping, and
[postprocessing](https://github.com/pmndrs/postprocessing) for bloom/vignette.
The cleaner UI uses [Inter](https://github.com/rsms/inter) and
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
| Audi R8 | V10-inspired | `v10` |
| Dodge Challenger | V8-inspired | `v8cross` |

The HUD shows RPM, gear and boost. Audio starts after the **Start engine** user
gesture, as required by browsers.

## Tests

```bash
npm test                     # scoring / spawn / physics / biome / weather / clock
node scripts/smoke.mjs       # headless browser playthrough (requires local server)
node scripts/world-shots.mjs # day/night/rain/snow/biome screenshots
node scripts/road-smoke.mjs  # surface/shader smoke test and weather screenshots
node scripts/upgrade-smoke.mjs # Rush / contracts / nitro / records browser test
```
