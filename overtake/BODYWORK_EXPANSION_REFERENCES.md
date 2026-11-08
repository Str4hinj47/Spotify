# Bodywork expansion: research and fit survey

This is preparatory research, **not a completed body-kit implementation**. The playable vehicles have different source meshes, material splits and wheel openings. The Golf's seam coordinates and replacement geometry cannot be copied directly to them. Front/rear parts should be visually verified against lamps, exhausts and wheel openings for each individual model; do not add an untrimmed shell over a factory bumper or rocker.

## Source references

The following are visual/construction references, not game assets; no product meshes or imagery were incorporated. Real products vary in fitment and some are for a related rather than identical model year. Designs must be original and fitted to the actual in-game source model.

- W222 Mercedes: [Magnatuning](https://www.magnatuning.com/en/products/977-36/Mercedes-S-Class-W222-Body-kit) lists replacement front and rear bumpers, skirts, and separate arch extensions; [W222 S65 kit](https://cargym.com/en-us/products/mercedes-benz-w222-s-class-s65-amg-style-body-kit) shows chrome moulding and exhaust tips as parts of a conversion.
- Audi Avant: [Prior Design C7 kit](https://www.royalbodykits.com/products/prior-design-wide-body-kit-audi-a6-s6-rs6-c7-avant) includes bumpers, fender widenings, side skirts and a diffuser; [Maxton C7](https://www.royalbodykits.com/products/maxton-design-wide-body-kit-audi-s6-c7-avant) lists different front and rear arch widths.
- Mustang: [1967 Mustang valances](https://www.carid.com/1967-ford-mustang-bumper-spoilers/) illustrate separate front/rear replacement valances. Check this model's actual generation before adapting the proportions.
- Ferrari: [458 full-body conversion](https://www.topendmotorsports.com/ferrari/458/exterior/body-kits/liberty-walk/lb-silhouette-works-gt-complete-wide-body-kit-5648.php) separates bumpers, fenders, skirts and diffuser; the game's asset must be fitted to its own asymmetric contours and centre exhaust.
- R8: [R8 widebody parts](https://trackuza.com/products/lb-works-audi-r8) list front/side/rear diffusers and wide fenders. The game's source has separate painted fascia, lower black trim, grille and lamps.
- Challenger: [widebody kit](https://shirok.ai/products/shirokai-dodge-challenger-hellcat-widebody-kit-2008-2023) lists front/rear flares, side skirts and bumper endings; [Circuit kit](https://carboncreations.com/2015-2020-dodge-challenger-duraflex-circuit-wide-body-kit-15-pieces-ed_113912/) includes a replacement fascia and diffuser.
- BMW: [E92 M3 GT kit](https://eternamotorworks.com/products/bmw-e92-m3-gtr-alms-widebody-kit) includes replacement bumpers, front fenders, rear flares, skirts and diffuser. The repository's source is a GT3 model, so this is a general construction reference rather than a claim of direct compatibility.
- Skyline: [R34 GT widebody](https://bulletproofautomotive.com/product/liberty-walk-lb-super-silhouette-widebody-kit-for-r34-nissan-skyline-gt-r/) includes replacement front/rear bumpers, wide fenders and side skirts.
- Aventador: [Aimgain Type II](https://pmddriven.com/collections/aimgain-1/products/aimgain-gt-type-ii-wide-body-lamborghini-aventador-perfect-body-kit-8-piece) combines a front bumper, under-spoilers, side wide spoilers, replacement fenders and a diffuser.

## Normalized source survey

Approximate measurements in the model wrapper's local coordinates, front = negative Z. Wheel radius is the registered wheel pivot radius; individual left/right wheels can differ. These are fit starting points, **not validated seam planes**.

| Car | Main body mesh(es) | Front / rear wheel Z | Wheel radius |
| --- | --- | --- | --- |
| Mercedes | `mercedes_mesh` plus trim/photo meshes 1–5, 9 | −1.739 / 1.422 | 0.342 |
| Audi Avant | `audi_mesh_10`; large grille and trim primitives | −1.537 / 1.386 | 0.368 |
| Mustang | `mustang_mesh_7`, trim meshes 1, 5, 8 | −1.434 / 1.246 | 0.346 |
| Ferrari | `ferrari_mesh_16`, separate `ferrari_mesh_43` front bumper | −1.081 / 1.345 (left side) | 0.329 |
| R8 | `body_color_8`, `body_color_12` and separate sill/body pieces | −1.219 / 1.428 | 0.314 |
| Challenger | `Plane005_Plane037` front, `Plane006_Plane038` rear, other paint primitives | −1.562 / 1.431 | 0.362 |
| BMW M3 | `bmw-m3_mesh`, `bmw-m3_mesh_8` plastic | −1.384 / 1.269 | 0.312 / 0.322 |
| Skyline | `skyline_mesh_2`, `skyline_mesh_10` front spoiler | −1.357 / 1.303 | 0.343 |
| Aventador | `aventador-game_mesh_10`, trim mesh 2 | −1.265 / 1.472 | 0.340 / 0.361 |

Run `BASE_URL=http://localhost:4186 node scripts/audit-bodywork-meshes.mjs` against a running Vite server to regenerate `test-results/bodywork-mesh-audit.json`, including per-mesh material names and bounding boxes. Review the result alongside actual player-clone screenshots. Bounds alone cannot prove the seams, fit or absence of overlap.
