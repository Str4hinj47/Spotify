# Scenery asset sources

The vegetation is based on Poly Haven models, released under CC0 1.0.
The following already-optimized 1K glTF versions were obtained from the
[`agrimuitobom/landscape` presets](https://github.com/agrimuitobom/landscape/tree/b39728c1c782ce377da77befd256b28d6002d459/presets)
([source manifest](https://github.com/agrimuitobom/landscape/blob/b39728c1c782ce377da77befd256b28d6002d459/presets/manifest.json)):

- `tree_small_02`: Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/tree_small_02). The source's textured leaf cards were thinned deterministically and enlarged, and branches simplified.
- `pine_sapling_01`: Rob Tuytel and Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/pine_sapling_01). The pre-optimized twig mesh is retained to preserve the foliage.
- `fern_02`: Rob Tuytel and Rico Cilliers / Poly Haven, [original](https://polyhaven.com/a/fern_02).

Each asset uses meshopt and WebP compression. `tools/prepare_scenery.mjs`
rebuilds the distributed GLBs from the above source preset GLBs placed in
`source-assets/polyhaven-landscape/`. The latter are ignored by Git. Original
model license: https://creativecommons.org/publicdomain/zero/1.0/ .

The meadow texture `public/textures/landscape/grass.jpg` was AI-generated
specifically for this game; it is not a Poly Haven asset. Existing vehicle
assets have separate provenance; their licenses are not implied by the
vegetation's CC0 status.
