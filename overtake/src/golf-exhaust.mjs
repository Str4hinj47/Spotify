// Shared by rear-surface cutouts, visible pipes and flame origins. R32-style
// rear includes its compatible left/right exhaust even when exhaust is stock.
export function golfExhaustLayout(config) {
  if (config.rear === 'golf-r32') {
    const radius = config.exhaust === 'sport' ? .063 : config.exhaust === 'track' || config.exhaust === 'flame' ? .061 : .055;
    return {centers:[-.48,.48], radius, y:.29};
  }
  if (config.exhaust === 'stock') return {centers:[],radius:0,y:.29};
  const amount={street:0,touring:.34,sport:.67,track:1,flame:1}[config.exhaust] ?? 0;
  return {centers:config.exhaust==='sport'?[-.52]:[-.52-.10*(config.exhaust==='touring'?.38:.5),-.52+.10*(config.exhaust==='touring'?.38:.5)],
    radius:.055*(config.exhaust==='sport'?1.2:.72+(.85-.72)*amount),y:.29};
}
