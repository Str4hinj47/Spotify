// Content definitions are shipped with the game. IDs must never be reused or
// removed: purchases and equipped liveries are saved under these IDs.
// New variants can reuse a renderer pattern and specify a suggested color.
export const LIVERY_OPTIONS = /** @type {const} */ ([
  { id:'none', label:'None', fittedLabel:null, pattern:'none', price:0, defaultColor:null, collection:'Launch' },
  { id:'stripe', label:'Stripes', fittedLabel:0, pattern:'stripe', price:350, defaultColor:null, collection:'Launch' },
  { id:'race', label:'Race graphics', fittedLabel:1, pattern:'race', price:700, defaultColor:null, collection:'Launch' },
  { id:'sunset-stripe', label:'Sunset stripe', fittedLabel:null, pattern:'center', price:500, defaultColor:'#ff7a1a', collection:'Color series' },
]);

// Swatches are color shortcuts, not exclusive items; custom paint has the same
// existing one-time per-car price. Add or reorder these without migrations.
export const PAINT_COLORS = /** @type {const} */ ([
  { name:'Rosso', hex:'#d40f1e' }, { name:'Nero', hex:'#101216' },
  { name:'Bianco', hex:'#e8eaee' }, { name:'Argento', hex:'#9fb0bf' },
  { name:'Blu', hex:'#1f5fd0' }, { name:'Giallo', hex:'#f2c230' },
  { name:'Verde', hex:'#1f6f43' }, { name:'Arancio', hex:'#ff7a1a' },
  { name:'Viola', hex:'#5b2a86' }, { name:'Grigio', hex:'#4a505a' },
]);
