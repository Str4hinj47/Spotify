# Front indicator placement

The game signals use amber areas on the represented cars' existing headlight or
parking-light geometry. These are visual approximations fitted to the supplied
3D assets, not claims that every trim or market uses an identical lamp. They
flash together with the existing Q/E or touchscreen indicators. No reference
images or third-party geometry were copied into the game.

| Game model | Placement used | Reference and limits |
| --- | --- | --- |
| Golf Mk4 | Outboard reflector in each front headlamp. | [Mk4 bulb reference](https://www.myturbodiesel.com/d2/1000q/multi/lightref.htm) distinguishes front turn signals from the separate side markers. Placement is fitted to the model's reflector. |
| Mercedes S 63, W222 | Bright inner LED contour of the front headlamp. | [W222 headlamp assembly](https://www.ebay.com/itm/405177071445) identifies front LED/amber indicators; the game model uses a photo texture, so the mask follows its bright contour rather than reconstructing individual factory LEDs. |
| Audi RS 6 Avant, C8 | Narrow strip in each headlamp. | [RS6 C8 headlamp specifications](https://www.autodoc.co.uk/car-parts/headlight-insert-10533/audi/a6/a6-avant-c8-4a5/138275-rs6-mild-hybrid-quattro) list indicators integrated into the headlamp. Some versions have a dynamic sweep; the game uses a synchronized flashing approximation. |
| Classic Mustang | Small front valance lamps below the bumper, with side markers where visible. | [1969 front marker bulb/valance locations](https://www.kentuckymustang.com/bulb-chart-bulb-replacement-buying-guide) and [parking/turn-signal assemblies](https://www.kentuckymustang.com/parking-light-turn-signal-bodies-pair-1969.html). The supplied car is a classic shape, not a modern S550; its buried original lens triangles are moved onto the valance to be visible. |
| Ferrari 458 Italia | Vertical LED area within each headlamp. | [458 headlamp specifications](https://www.autodoc.parts/car-parts/headlight-insert-10533/ferrari/458) identify an integrated LED indicator. Exact LED segmentation is approximated on the supplied model. |
| Audi R8 | Upper light guide within each headlamp. | [Audi R8 headlamp assembly](https://parts.audiusa.com/p/Audi__R8/Headlight/48769793/420941030Q.html) documents the integrated turn-signal function. The cited part is for an earlier R8, so the precise guide shape is fitted to this game's later-looking asset. |
| Dodge Challenger | The two halo perimeters on the indicated side; projector centers stay unchanged. | [2015 Challenger owner's discussion](https://www.challengertalk.com/threads/%E2%80%9Cturn-signal-out%E2%80%9D.659879/) describes the integrated turn-signal/DRL halo. |

Rendered regression: `BASE_URL=http://localhost:3003 node scripts/indicators-smoke.mjs`.
