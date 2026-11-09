/** Positions in normalized car space, shared by the fascia, tips and flames. */
export function bmwExhaustLayout(exhaust) {
  if (exhaust === 'stock') return {centers:[-.55,-.46,.46,.55], y:.28, radius:.04, mouthZ:2.23, oval:false};
  const track=exhaust==='track'||exhaust==='flame', sport=exhaust==='sport';
  const amount=({street:0,touring:.34,sport:.67,track:1,flame:1})[exhaust] ?? 0;
  const offset=.13*(track?.5:.4);
  const centers=track||sport?[-.52-offset,-.52+offset,.52-offset,.52+offset]:[-.52,.52];
  const radius=.065*((track || sport) ? .64 : .85 + .17*amount);
  return {centers,y:.29,radius,mouthZ:2.244,oval:exhaust==='touring'};
}
