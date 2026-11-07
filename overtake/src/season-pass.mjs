// Local seasonal reward track. The UTC quarter is shared with Seasonal
// Challenge; completed quests are repeatable across runs. Rewards stay owned.
export const SEASON_TIERS = Object.freeze([
  {xp:100, car:'golf', type:'tune', key:'front', value:'street', label:'Flux · GT front lip'},
  {xp:200, car:'golf', type:'upgrade', key:'tires', level:1, label:'Flux · tire upgrade stage 1'},
  {xp:300, car:'golf', type:'tune', key:'underglow', value:'on', label:'Flux · underglow'},
  {xp:400, car:'mustang', type:'tune', key:'spoiler', value:'track', label:'Stampede · pedestal wing'},
  {xp:500, car:'skyline', type:'upgrade', key:'engine', level:1, label:'Specter · engine upgrade stage 1'},
  {xp:600, car:'bmw-m3', type:'tune', key:'hood', value:'sport', label:'Circuit GT · sport hood'},
  {xp:700, car:'aventador-game', type:'tune', key:'roof', value:'track', label:'Tempest · race roof'},
  {xp:800, car:'r8', type:'tune', key:'underglow', value:'on', label:'Vector · underglow'},
]);
// Premium is cosmetic-only: no exclusive performance or car unlocks.
export const PREMIUM_PASS_PRICE = 50;
export const PREMIUM_TIERS = Object.freeze([
 {xp:100,car:'golf',type:'tune',key:'livery',value:'race',label:'Flux · cup race graphics'},
 {xp:200,car:'mustang',type:'tune',key:'hood',value:'track',label:'Stampede · track hood scoop'},
 {xp:300,car:'bmw-m3',type:'tune',key:'underglow',value:'on',label:'Circuit GT · underglow'},
 {xp:400,car:'skyline',type:'tune',key:'roof',value:'track',label:'Specter · triple roof fins'},
 {xp:500,car:'ferrari',type:'tune',key:'livery',value:'sunset-stripe',label:'Veloce · sunset stripe'},
 {xp:600,car:'r8',type:'tune',key:'spoiler',value:'track',label:'Vector · track wing'},
 {xp:700,car:'aventador-game',type:'tune',key:'front',value:'track',label:'Tempest · track front'},
 {xp:800,car:'challenger',type:'tune',key:'hood',value:'track',label:'Brawler · track scoop'},
]);
export function seasonPeriod(now=Date.now()) { const d=new Date(now);return d.getUTCFullYear()*4+Math.floor(d.getUTCMonth()/3); }
export function seasonLabel(period) { return `${Math.floor(period/4)} · Q${period%4+1}`; }
export function sanitizeSeasonPass(raw) {
  if (!raw || !Number.isSafeInteger(raw.period) || raw.period<0 || raw.period>100000 || !Number.isFinite(raw.xp)) return null;
  return {period:raw.period,xp:Math.max(0,Math.min(SEASON_TIERS.at(-1).xp,Math.floor(raw.xp))),premium:raw.premium===true};
}
export function currentSeasonPass(raw,now=Date.now()) {
 const period=seasonPeriod(now), clean=sanitizeSeasonPass(raw);
 return clean?.period===period ? clean : {period,xp:0,premium:false};
}
