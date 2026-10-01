# 🏯 Tokyo Grand Prix — a Cars 2 Japan-race tribute

A self-contained 3D night racer built with three.js (vendored, no build step, no
external CDNs). Inspired by the World Grand Prix opening race in Pixar's *Cars 2*:
neon Tokyo at night, torii gates, a sakura-blizzard grove, an elevated bay bridge,
and Francesco Bernoulli to beat.

## Run it

```bash
cd tokyo-grand-prix
python3 -m http.server 3000
# open http://localhost:3000
```

(Any static file server works — ES modules need http://, not file://.)

## Race

- 3 laps against 5 rivals (Francesco Bernoulli, Carla Veloso, Shu Todoroki,
  Max Schnell, Nigel Gearsley) with corner-speed AI, lane weaving and
  gentle rubber-banding.
- Landscape circuit (~1.8 km) with elevation: start straight → banking sweeper →
  bay-bridge S-curves → sakura chicane → left sweepers → hairpin → final corner.
- Drift with SPACE for tight corners (trade grip for rotation), walls spark and
  thunk, wrong-way detection, checkpointed lap validation.
- 3 cameras (chase / far / hood — press C), pause (P), reset to track (R).

## Controls

| Key | Action |
| --- | --- |
| W / ↑ | gas |
| S / ↓ | brake / reverse |
| A D / ← → | steer |
| SPACE | drift |
| C | camera |
| R | reset to track |
| M | mute |
| P / ESC | pause |

Touch controls appear automatically on coarse-pointer devices.

## Extras to spot

- **Party Mater** parties in the zen garden beside the track (sombrero included).
- Jumbotrons stream live race position, Tokyo Tower and a Ferris wheel animate,
  kanji sign stacks, billboards, rooftop beacons, falling sakura petals.
- Synthesised audio: engine, skids, wall impacts, countdown, taiko-flavoured
  race beat, lap chimes and a finish fanfare (M to mute).
- Best lap is saved in `localStorage` as a track record.

## Structure

```
index.html            markup + import map
style.css             HUD / overlays / touch UI
js/track.js           circuit spline, road & rail geometry, lookup tables
js/environment.js     Tokyo skyline, landmarks, particles
js/cars.js            character-car meshes, player physics, AI
js/hud.js             HUD, minimap, standings, results
js/audio.js           WebAudio synthesised SFX
js/main.js            game loop, cameras, race flow
vendor/three/         vendored three.js r170 + postprocessing addons
```
