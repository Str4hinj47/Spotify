// Pure helpers for per-car paint customization (shared by UI and tests).

/** @param {unknown} value */
export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  let s = value.trim().toLowerCase();
  if (!s.startsWith('#')) s = `#${s}`;
  if (/^#[0-9a-f]{3}$/.test(s)) {
    s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
  }
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

/** @param {string} hex */
export function hexToNumber(hex) {
  const n = normalizeHex(hex);
  if (!n) throw new Error(`Invalid paint hex: ${hex}`);
  return Number.parseInt(n.slice(1), 16);
}

/** @param {number} n */
export function numberToHex(n) {
  const v = Math.max(0, Math.min(0xffffff, Math.round(n)));
  return `#${v.toString(16).padStart(6, '0')}`;
}

/**
 * Keep only known car ids and valid hex colors.
 * @param {unknown} raw
 * @param {readonly string[]} ids
 * @returns {Record<string, string>}
 */
export function sanitizePaints(raw, ids) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const id of ids) {
    const hex = normalizeHex(/** @type {Record<string, unknown>} */ (raw)[id]);
    if (hex) out[id] = hex;
  }
  return out;
}
