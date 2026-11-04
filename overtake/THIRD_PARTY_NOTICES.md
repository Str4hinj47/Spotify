# Third-party notices

OVERTAKE uses the following open-source projects.

| Project | Repository | License | Use |
| --- | --- | --- | --- |
| three.js | https://github.com/mrdoob/three.js | MIT | Rendering, instancing, lights, materials, `RoomEnvironment` studio IBL, `RectAreaLightUniformsLib`, PMREM prefiltering |
| simplex-noise | https://github.com/jwagner/simplex-noise.js | MIT | Biome selection and weather noise |
| maath | https://github.com/pmndrs/maath | MIT | Frame-rate-independent damping/easing |
| postprocessing | https://github.com/pmndrs/postprocessing | Zlib | Bloom, vignette, Khronos PBR-neutral tone mapping |
| Inter | https://github.com/rsms/inter | SIL OFL 1.1 | UI font, via @fontsource-variable/inter |
| Elemental-Serenity | https://github.com/SahilK-027/Elemental-Serenity | MIT | Rain/snow particle approach adapted in `src/world/precipitation.ts` |
| Engine_Sim | https://github.com/YigitSalihEmecen/Engine_Sim | MIT | Procedural engine audio, vendored in `src/vendor/engine-sim` |
| Lucide | https://github.com/lucide-icons/lucide | ISC | UI icons |

## Lighting / car paint

The garage uses three.js's MIT-licensed `RoomEnvironment` (from
`mrdoob/three.js`, based on Google model-viewer's environment scene) prefiltered
with `PMREMGenerator`, plus rectangular softbox lights. Road reflections use a
small HDR sky environment generated from the live atmosphere and prefiltered the
same way. Car paint is a `MeshPhysicalMaterial` basecoat + clearcoat, and the
frame is tone-mapped with the Khronos PBR-neutral curve via `postprocessing`
instead of the older ACES canvas-gradient look.

## Elemental-Serenity adaptation

`src/world/precipitation.ts` adapts the camera-following rain line-streak and
snow point-sprite approach from Elemental-Serenity, reworked for a moving
highway camera, weather intensity fading, and wind/vehicle-speed coupling.

MIT License

Copyright (c) 2026 Sahil K

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
