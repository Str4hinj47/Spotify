// Manual cloud snapshots are convenience backups, not trusted game records.
import { CAR_PRICES, sanitizeProgression } from './progression.mjs';
import { sanitizePaints } from './paint.mjs';
import { sanitizeCustomizations } from './customization.mjs';
import { emptyRecords, sanitizeRecords } from './records.mjs';

const CARS = Object.keys(CAR_PRICES);
export const CLOUD_BACKUP_KEY = 'overtake-cloud-restore-backup-v1';
export const CLOUD_KEYS = Object.freeze(['overtake-progression-v2', 'overtake-paints', 'overtake-customization-v1', 'overtake-car', 'overtake-records-v2', 'overtake-best']);
const MAX_BYTES = 100_000;
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const boundedJson = x => {
  const text = JSON.stringify(x);
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Save data is too large.');
  return text;
};
const readJson = (storage, key, fallback) => {
  const value = storage.getItem(key);
  if (value === null) return fallback;
  try { return JSON.parse(value); } catch { throw new Error(`Local save is damaged (${key}).`); }
};

/** Validate a versioned snapshot before applying; unknown future schemas are never overwritten. */
export function normalizeSnapshot(raw) {
  boundedJson(raw);
  if (!object(raw) || raw.schema !== 1 || !object(raw.progression) || raw.progression.version !== 2 ||
      !object(raw.paints) || !object(raw.customizations) || !object(raw.records) || raw.records.version !== 2 || !object(raw.records.modes)) {
    throw new Error('Unsupported or damaged cloud save; nothing was changed.');
  }
  const progression = sanitizeProgression(raw.progression);
  progression.dev = false; // Never transfer developer access between devices.
  const records = sanitizeRecords(raw.records);
  // Reject non-finite results (including strings such as "Infinity") rather than persist them.
  const text = JSON.stringify(records, (_key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Cloud save contains invalid records.');
    return value;
  });
  const result = { schema: 1, progression, paints: sanitizePaints(raw.paints, CARS),
    customizations: sanitizeCustomizations(raw.customizations, CARS),
    selectedCar: CARS.includes(raw.selectedCar) ? raw.selectedCar : 'golf', records: JSON.parse(text) };
  boundedJson(result);
  return result;
}

/** Capture only known game keys, never auth/session or unrelated site data. */
export function captureSnapshot(storage) {
  const progression = readJson(storage, 'overtake-progression-v2', null);
  if (!object(progression) || progression.version !== 2) throw new Error('Open the game on this device first to create a local save.');
  const records = readJson(storage, 'overtake-records-v2', emptyRecords());
  if (!object(records) || records.version !== 2 || !object(records.modes)) throw new Error('Local records are damaged; nothing was uploaded.');
  const cleanRecords = sanitizeRecords(records);
  const legacy = Number(storage.getItem('overtake-best') || 0);
  if (Number.isFinite(legacy)) cleanRecords.modes.endless.bestScore = Math.max(cleanRecords.modes.endless.bestScore, legacy);
  return normalizeSnapshot({ schema: 1, progression, records: cleanRecords,
    paints: readJson(storage, 'overtake-paints', {}), customizations: readJson(storage, 'overtake-customization-v1', {}),
    selectedCar: storage.getItem('overtake-car') || 'golf' });
}

function currentValues(storage) { return Object.fromEntries(CLOUD_KEYS.map(key => [key, storage.getItem(key)])); }
function applyValues(storage, values) {
  for (const key of CLOUD_KEYS) values[key] === null ? storage.removeItem(key) : storage.setItem(key, values[key]);
}
function replaceWithBackup(storage, values) {
  const before = currentValues(storage);
  // Backup first: if storage is unavailable/full, leave current game data untouched.
  storage.setItem(CLOUD_BACKUP_KEY, boundedJson({ version: 1, values: before }));
  try { applyValues(storage, values); }
  catch {
    try { applyValues(storage, before); } catch { throw new Error('Storage failed during restore and rollback. Your previous data is in the local restore backup if it was saved.'); }
    throw new Error('Storage failed during restore. Your previous data was restored.');
  }
}
export function restoreSnapshot(storage, raw) {
  const s = normalizeSnapshot(raw);
  replaceWithBackup(storage, {
    'overtake-progression-v2': JSON.stringify(s.progression), 'overtake-paints': JSON.stringify(s.paints),
    'overtake-customization-v1': JSON.stringify(s.customizations), 'overtake-car': s.selectedCar,
    'overtake-records-v2': JSON.stringify(s.records), 'overtake-best': String(s.records.modes.endless.bestScore),
  });
}
/** Swap current local data with the last pre-restore state. */
export function undoRestore(storage) {
  const backup = readJson(storage, CLOUD_BACKUP_KEY, null);
  if (!object(backup) || backup.version !== 1 || !object(backup.values) ||
      CLOUD_KEYS.some(key => !(key in backup.values) || (backup.values[key] !== null && typeof backup.values[key] !== 'string'))) {
    throw new Error('No valid local restore backup found.');
  }
  boundedJson(backup);
  replaceWithBackup(storage, backup.values);
}
