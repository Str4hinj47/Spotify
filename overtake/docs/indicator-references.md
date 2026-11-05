# Rear turn signal references

The car assets are artist-made and don't always contain separately modeled
indicator LEDs. The game masks the existing rear lens geometry (never a floating
sprite or a front lamp). Where the exact model year/market is unclear, the mask
is an approximation aligned to the visible lens; it is not a replacement OEM
lamp assembly. Q toggles left, E toggles right.

| Model in game | Placement / behavior used | Reference |
| --- | --- | --- |
| Golf Mk4 | Amber section of the outer rear light cluster | [Mk IV lamp replacement guide](https://www.pelicanparts.com/techarticles/Volkswagen_Golf_GTI_Mk_IV/69-BODY-Replacing_Your_Tail_Light_Bulbs_and_Assembly/69-BODY-Replacing_Your_Tail_Light_Bulbs_and_Assembly.htm) |
| Mercedes S 63 W222 | Amber strip in the rear lamp lens; approximated on the texture-baked asset | [W222 rear lamp](https://www.amazon.com/Ayerann-Compatible-Mercedes-Benz-2014-2017-A2229065401/dp/B0G7CMV2M9) |
| Audi RS 6 C7 Avant | Amber upper row of each outer rear light | [C7 lamp/indicator discussion](https://www.audizine.com/threads/c7-s6-red-update-led-sequential-indicator-tail-lights-pre-facelift.828584/) and [RS6 C7 rear lamps](https://www.autodoc.co.uk/car-parts/combination-rearlight-10554/audi/a6/a6-avant-4g5-c7-4gd/59276-rs6) |
| Ford Mustang | Red rear lamp, using its three vertical bars. The asset resembles a 1969-era Mustang rather than the newer S550. | [1969 Mustang bulbs](https://www.superbrightleds.com/vehicle/?find=1969-ford-mustang-6798571), [1965–70 conversion instructions](https://www.cjponyparts.com/media/images/install-pdf/install_stl2.pdf) |
| Ferrari 458 | Inner portion of the round rear light, amber European-style | [Ferrari rear lamp diagram](https://eurospares.com/Ferrari/458/458_Italia_(RHD)/PartDiagrams/0127/HEADLIGHTS_AND_TAILLIGHTS) and [European vs US rear signals](https://www.ferrarichat.com/forum/threads/458-tail-lights.454152/) |
| Audi R8 | Thin amber strip along the lower edge of the rear light, European-style | [R8 rear indicator placement](https://www.r8talk.com/threads/euro-rear-indicators.113970/) |
| Dodge Challenger | Red outer rear lamp on the signaling side, shared with the brake light | [Challenger integrated brake/turn lamps](https://www.challengertalk.com/threads/2015-euro-tail-light-conversion.313674/) |

US-market Mustang and Challenger lamps use red rear indicators; the other
models use an amber European-style indication. When a red combined lamp is
signaling it blinks on that side even if the brakes are applied, while the
opposite brake lamp remains lit.
