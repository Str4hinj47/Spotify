# OVERTAKE — Endless Highway

A browser-based, free-steering two-way overtaking game built with Three.js.
Pick one of seven cars; the other models become traffic. Two additional truck models appear only as NPCs.

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
| `Q` / `E` | Toggle left / right turn signal |
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
  pays bonus points.
- **Smarter traffic:** same-direction cars follow slower leaders and brake
  instead of stacking; rear lights brighten while braking. A time-to-collision hazard
  radar warns about the nearest closing threat. Nearby traffic avoids repeating
  car models and uses contrasting paint colors where possible. Each model has
  its own cruise speed, with slight driver-to-driver variation. From 1,500 points,
  rare, slower trucks can create queues; cars may pass them only after checking
  the projected opposing and return lanes. The opposing lane is reserved against
  new spawns until the pass is complete.
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
- Hitting traffic or the barrier ends the run. Closely aligned cars leave no safe center gap, and the guardrail checks the full vehicle footprint.

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
| Tractor trailer (NPC only) | `Peferbuilt Tractor Trailer.zip` — ThePefDispenser, CC BY 3.0 |
| KrAZ truck (NPC only) | `2078f5d818ddfa83c382576451a4e618.zip` — user-provided, license not specified |

The owner reports permission to redistribute and modify the supplied models.
Source-license evidence for several models and commercial rights for KrAZ still
need verification; vehicle designs and trademarks are separate from model
licenses. Identified badges were removed as a precaution, not as legal clearance.
See `THIRD_PARTY_NOTICES.md` (also linked from the in-game help) for details.

The original `.blend` files were converted to Draco-compressed glTF with
`tools/convert_assets.py` (requires Blender's `bpy` module). Geometry is
adapted; materials were rebuilt as lightweight PBR for real-time rendering.
Identified badges and branded textures are removed by `tools/sanitize_vehicle_branding.mjs`
after conversion (the Mercedes atlas step requires Python Pillow).
Studio helpers, ground planes and light blockers were removed. Headlight and
taillight lenses are preserved and emissive; the Ferrari's source-mesh yaw is
corrected so it runs parallel to the road. Its detached studio artifact was removed and its front wheels straightened. The two OBJ assets use `tools/convert_obj.mjs` to rebuild materials, selectively simplify and Draco-compress the geometry while retaining body panel detail; `tools/fix_ferrari.mjs` documents the Ferrari correction. `tools/repair_paint_normals.mjs` regenerates creased body normals on the Audi RS 6, Mustang and Ferrari without changing their geometry, to reduce triangular highlights. The RS 6 uses a higher mesh budget to preserve smooth body contours; after converting it, run `node tools/repair_paint_normals.mjs public/models/audi.glb /tmp/audi-smooth.glb`, copy the result back, then run `node tools/sanitize_vehicle_branding.mjs audi` to reapply badge cleanup and update the manifest.

The truck conversion is documented in `tools/convert_trucks.py`; it preserves
instanced semi wheels, rebuilds real-time materials and normalizes the models
for the road. `tools/repair_truck_normals.mjs` repairs trailer panel shading.

### Body workshop

Open **Customize body & lighting** in the garage to choose fitted front and
rear bumper add-ons, skirts, spoilers and exhaust tips independently for each
of the seven cars. Each offers factory, a road-oriented option and a more
aggressive option; their dimensions and detailing are tailored to the model.
Choose carbon fiber independently for each aftermarket part. The afterfire
exhaust previews flames in the garage and produces flames while accelerating
on the road. Choose an upper or lower two-tone paint layout, a second paint
color or carbon finish, and one of two car-specific liveries with a custom
color. The workshop also offers arbitrary-color underglow and front/side/rear
views or drag-to-rotate inspection. These workshop settings are saved per car
in local storage, apply only to the player in the garage and on the road, and
are cosmetic: they do not change handling or traffic cars. Reset car clears
that car's workshop choices, including its two-tone and livery, but retains
its separate primary paint color.

### Paint customization

The garage includes a paint panel for every car: ten swatches, a custom color
picker, and a **Factory** reset. Paint is saved per car in `localStorage`
(`overtake-paints`) and is applied to the player car and, where it remains distinct from nearby traffic, to traffic instances
of that model.

## World, weather and day–night

The background no longer swaps biomes abruptly. Roadside scenery is placed in
deterministic slots with layered foliage and visible trunks, low-poly middle-distance tree lines, grass tufts and detailed building facades, and cross-faded by distance through **meadow → forest →
alpine → desert → outskirts** using `simplex-noise` and smoothstep weights
(`src/world/biomes.mjs`). Ground, shoulder, mountain and fog colours blend with
the same weights. Layered continuous ridgelines, world-anchored ground variation
and drifting procedural clouds add depth while responding to weather and time of day.

A day–night clock (`src/world/clock.mjs`) drives the sky gradient, sun disc,
moon, stars, street lamps and player headlights. A full cycle takes 10 minutes
at 1×. The world panel lets you scrub time, change cycle speed, pause the cycle,
or force **Auto / Clear / Rain / Snow**. The highway has curved, corrugated
metal guardrails with regularly spaced posts and reflectors; their upper edges
collect snow. Streetlights use tapered poles, detailed bases, curved arms,
rounded housings and weather/time-responsive luminous lenses. Instanced roadside
warning signs, faceted rocks and more detailed buildings add variety without
placing obstacles in the driving lane.

Weather (`src/world/weather.mjs`) damps in/out instead of switching instantly.
The road uses ambientCG asphalt and gravel colour/normal maps and weathered painted markings. Rain darkens both asphalt and gravel with a varied wet film and creates irregular reflective puddles with animated raindrop ripples, thickens fog, and adds camera-following rain streaks. Snow adds dense wind-blown flakes, and a separately raised, textured layer with irregular snow banks, wind-shaped drifts, compacted slush and shallow tire ruts, as well as snow on the ground/shoulders/trees and heavier fog. Trees catch
snow on their upward-facing foliage, and the player's tires leave a subtle
speed-dependent mist or powder trail on wet or snowy roads. Road textures and snow patterns stay anchored to road distance as you drive. Both reduce tyre grip, acceleration and braking traction while the surface gradually accumulates and clears. The rain/snow particle approach is
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

Use the top-bar **Sound settings** button (also available in the pause menu)
to switch score/reward sounds and indicator clicks independently. Preferences
are saved on this device. The speaker button or **M** mutes everything without
changing those choices; indicator clicks follow the visible blink phase and
stop while paused.

The digital instrument cluster shows speed in km/h, current automatic gear and RPM. Its speed arc scales to the selected car’s top speed, and the RPM strip highlights the redline. The engine telemetry remains active while audio is muted. Audio starts after the **Start engine** user
gesture, as required by browsers.

## Tests

```bash
npm test                     # scoring / spawn / physics / biome / weather / clock
node scripts/smoke.mjs       # headless browser playthrough (requires local server)
node scripts/world-shots.mjs # day/night/rain/snow/biome screenshots
node scripts/landscape-smoke.mjs # landscape weather, biome and slot continuity
node scripts/speedometer-smoke.mjs # speed, gear, RPM and responsive dashboard
node scripts/sound-settings-smoke.mjs # saved sound controls and synchronized indicator clicks
node scripts/customization-smoke.mjs # workshop, persistence, model fit and driving
node scripts/livery-flames-smoke.mjs # paint, carbon, liveries and exhaust flames
node scripts/road-smoke.mjs  # road, barriers, lamps and weather shader checks
node scripts/road-detail-smoke.mjs # streetlight close-up and mobile snow view
node scripts/extra-graphics-smoke.mjs # tire spray, snowy foliage and roadside signs
node scripts/vehicle-snow-smoke.mjs # car materials, snow density and antialiasing
node scripts/controls-scenery-smoke.mjs # indicators, brake lights, traffic and collisions
node scripts/truck-traffic-smoke.mjs # NPC trucks, queues and passing-lane safety
node scripts/upgrade-smoke.mjs # Rush / contracts / records browser test
```

### Car image quality

The renderer uses modest, pixel-budgeted desktop supersampling and anisotropic
filtering on vehicle textures; mobile keeps its existing pixel-ratio cap. These
settings trade some GPU time and memory for sharper details. The W222 photo
atlas is restored from the original 4096-pixel source (after the same badge and
plate masking), and the 458 tire textures use their original resolutions. The
other cars' source assets have limited or no useful color textures, so the game
cannot invent finer photographic detail for them.

For a texture-only restore without changing mesh geometry, extract the packed
source images `W222_Photo_Texture.1001.png`, `wheel_tread.png.000` and
`wheel_side.png.000` from the respective Blender source files. Redact the W222
image with `tools/redact_mercedes_atlas.py`, save the opaque result as a
high-quality JPEG named `mercedes-clean.jpg`, and name the Ferrari files
`ferrari-tread.png` and `ferrari-side.png`. Run
`node tools/restore_car_textures.mjs <prepared-image-directory>` from this
folder. The tool replaces only image buffer views; it doesn't decimate or
re-encode the car meshes. The Blender converter's texture caps preserve these
resolutions on future full conversions; run the branding cleanup after any
full conversion.
