// Content definitions are shipped with the game. IDs must never be reused or
// removed: purchases and equipped liveries are saved under these IDs.
// New variants can reuse a renderer pattern and specify a suggested color.
export const LIVERY_OPTIONS = /** @type {const} */ ([
  { id:'none', label:'None', fittedLabel:null, pattern:'none', price:0, defaultColor:null, collection:'Launch' },
  { id:'stripe', label:'Stripes', fittedLabel:0, pattern:'stripe', price:7, defaultColor:null, collection:'Launch' },
  { id:'race', label:'Race graphics', fittedLabel:1, pattern:'race', price:14, defaultColor:null, collection:'Launch' },
  { id:'sprint-offset', label:'Sprint offset', fittedLabel:null, pattern:'sprint', price:9, defaultColor:null, collection:'Street graphics' },
  { id:'velocity', label:'Velocity', fittedLabel:null, pattern:'velocity', price:12, defaultColor:null, collection:'Street graphics' },
  { id:'heritage', label:'Heritage', fittedLabel:null, pattern:'heritage', price:10, defaultColor:null, collection:'Street graphics' },
  { id:'apex', label:'Apex', fittedLabel:null, pattern:'apex', price:16, defaultColor:null, collection:'Street graphics' },
  { id:'flames', label:'Flames', fittedLabel:null, pattern:'flames', price:15, defaultColor:'#ff6a1a', collection:'Street graphics' },
  { id:'sunset-stripe', label:'Sunset stripe', fittedLabel:null, pattern:'center', price:10, defaultColor:'#ff7a1a', collection:'Color series' },
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

// Stable IDs: these designs come from the uploaded wheel FBX.
export const RIM_OPTIONS = /** @type {const} */ (['stock', ...Array.from({length:10}, (_,i) => `rim-${i+1}`)]);
