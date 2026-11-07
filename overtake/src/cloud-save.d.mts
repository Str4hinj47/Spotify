export const CLOUD_BACKUP_KEY: string;
export const CLOUD_KEYS: readonly string[];
export interface CloudSnapshot { schema: 1; progression: import('./progression.mjs').Progression; paints: Record<string,string>; customizations: Record<string, import('./customization.mjs').Customization>; selectedCar: string; records: import('./records.mjs').Records; ranked: import('./ranked.mjs').RankedState | null; }
export function normalizeSnapshot(raw: unknown): CloudSnapshot;
export function captureSnapshot(storage: Storage): CloudSnapshot;
export function restoreSnapshot(storage: Storage, raw: unknown): void;
export function undoRestore(storage: Storage): void;
