export type GhostSample = [number, number, number, number];
export interface GhostReplay { version: 1; time: number; samples: GhostSample[]; }
export const GHOST_PREFIX: string;
export const MAX_GHOST_SAMPLES: number;
export function sanitizeGhost(value: unknown): GhostReplay | null;
export function loadGhost(storage: Storage, car: string): GhostReplay | null;
export function saveGhost(storage: Storage, car: string, replay: GhostReplay): boolean;
export function ghostAt(replay: GhostReplay, time: number): GhostSample;
