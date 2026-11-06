# Scenery asset sources

The vegetation is based on Poly Haven models, released under CC0 1.0.
The following already-optimized 1K glTF versions were obtained from the
[`agrimuitobom/landscape` presets](https://github.com/agrimuitobom/landscape/tree/b39728c1c782ce377da77befd256b28d6002d459/presets)
([source manifest](https://github.com/agrimuitobom/landscape/blob/b39728c1c782ce377da77befd256b28d6002d459/presets/manifest.json)):

- `tree_small_02`: Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/tree_small_02). The source's textured leaf cards were thinned deterministically and enlarged, and branches simplified.
- `boulder_01`: Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/boulder_01). Further reduced using meshoptimizer sloppy simplification for roadside use.
- `fern_02`: Rob Tuytel and Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/fern_02).

Each asset uses meshopt and WebP compression. `tools/prepare_scenery.mjs`
rebuilds the distributed GLBs from the above source preset GLBs placed in
`source-assets/polyhaven-landscape/`. The latter are ignored by Git. Original
model license: https://creativecommons.org/publicdomain/zero/1.0/ .

The meadow texture `public/textures/landscape/grass.jpg` and pine foliage cutout
`public/textures/landscape/pine.png`, and the mountain panorama
`public/textures/landscape/mountain-panorama.png` and
`public/textures/landscape/desert-panorama.png`, and
`public/textures/landscape/facade.jpg`, the roadside grass cutout
`public/textures/landscape/roadside-grass.png` and cloud layer
`public/textures/landscape/clouds.jpg`,
`public/textures/landscape/wildflower.png`,
`public/textures/landscape/desert-scrub.png`, and
`public/textures/landscape/desert-ground.jpg`,
`public/textures/landscape/treeline.png`, and
`public/textures/landscape/brick-facade.jpg` were AI-generated specifically for this game; they are not Poly Haven assets. Existing vehicle
assets have separate provenance; their licenses are not implied by the
vegetation's CC0 status.

The mountain material uses a reduced 1024px version of Poly Haven's CC0
[`cliff_side`](https://polyhaven.com/a/cliff_side) texture by James Ray Cock,
Jenelle van Heerden and Dario Barresi. The 2K source was obtained from the
[AstraWeave Poly Haven asset manifest](https://github.com/lazyxeon/AstraWeave/blob/d01720a81c3776efa233ee3fd84d72f1094ac7a7/assets/terrain/polyhaven/pine_forest/manifest.json).
