# HDR environment asset sources

The four environment maps in `public/env/` are CC0 [Poly Haven](https://polyhaven.com/)
HDRIs distributed with the [three.js examples](https://github.com/mrdoob/three.js).
Source: three.js `dev` commit
`a70ee1ad92a681b7b8c42d23b6ede4febb28b25c`,
`examples/textures/equirectangular/`. Poly Haven's assets are released under
[CC0 1.0](https://polyhaven.com/license); attribution is not required but is
recorded here for provenance. The three.js example texture documentation also
identifies Poly Haven CC0 as the source of its equirectangular HDRIs (see
`examples/textures/hdr-native/README.md` and
`examples/textures/pmrem/README.md`).

| Distributed file | Original three.js example | Poly Haven asset | Author | Used for |
| --- | --- | --- | --- | --- |
| `studio.hdr` | `monochrome_studio_02_1k.hdr` | [Monochrome Studio 02](https://polyhaven.com/a/monochrome_studio_02) | Grzegorz Wronkowski | Garage/showroom softbox reflections |
| `day.hdr` | `spruit_sunrise_1k.hdr` | [Spruit Sunrise](https://polyhaven.com/a/spruit_sunrise) | Greg Zaal | Meadow, forest and alpine daylight |
| `arid.hdr` | `quarry_01_1k.hdr` | [Quarry 01](https://polyhaven.com/a/quarry_01) | Sergej Majboroda | Desert and outskirts daylight |
| `night.hdr` | `moonless_golf_1k.hdr` | [Moonless Golf](https://polyhaven.com/a/moonless_golf) | Greg Zaal | Night and heavy overcast |

The originals are 1024×512 Radiance RGBE files. They were downsampled to
512×256 with open-source [ImageMagick](https://github.com/ImageMagick/ImageMagick)
to keep the browser payload small while retaining enough directional detail for
PMREM-prefiltered car paint and glass. Dawn/dusk environments are generated at
runtime as linear radiance blends of the day and night maps; no additional
asset is shipped.

At startup `src/world/environment.ts` loads them with three.js `HDRLoader`,
prefilters them with `PMREMGenerator`, and selects/rotates the resulting
`scene.environment` by time, weather and biome. Procedural canvas gradients
remain as fallbacks if an HDRI cannot be fetched or PMREM generation fails.
