# Third-party notices

OVERTAKE uses the following open-source projects.

| Project | Repository | License | Use |
| --- | --- | --- | --- |
| three.js | https://github.com/mrdoob/three.js | MIT | Rendering, instancing, lights, materials |
| simplex-noise | https://github.com/jwagner/simplex-noise.js | MIT | Biome selection and weather noise |
| maath | https://github.com/pmndrs/maath | MIT | Frame-rate-independent damping/easing |
| postprocessing | https://github.com/pmndrs/postprocessing | Zlib | Bloom and vignette |
| Inter | https://github.com/rsms/inter | SIL OFL 1.1 | UI font, via @fontsource-variable/inter |
| Elemental-Serenity | https://github.com/SahilK-027/Elemental-Serenity | MIT | Rain/snow particle approach adapted in `src/world/precipitation.ts` |
| Engine_Sim | https://github.com/YigitSalihEmecen/Engine_Sim | MIT | Procedural engine audio, vendored in `src/vendor/engine-sim` |
| Lucide | https://github.com/lucide-icons/lucide | ISC | UI icons |

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

## Road textures

The asphalt, snow and gravel colour and OpenGL normal maps in
`public/textures/road/` are from [ambientCG](https://ambientcg.com/), dedicated
to the public domain under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/):
[Asphalt031](https://ambientcg.com/view?id=Asphalt031),
[Snow004](https://ambientcg.com/view?id=Snow004), and
[Gravel023](https://ambientcg.com/view?id=Gravel023). The 1K JPEG versions were
re-encoded and distributed in the [Torqa texture assets](https://github.com/bossm8/Torqa/pull/58),
whose credits identify these sources and the CC0 dedication.
