import type { CarId } from './catalog';
export interface Progression { version: 1; xp: number; dev: boolean; legacyCar: CarId | null; }
export const CAR_XP: Readonly<Record<CarId, number>>;
export function emptyProgression(): Progression;
export function sanitizeProgression(raw: unknown): Progression;
export function migrateProgression(records: unknown, savedCar: unknown): Progression;
export function xpForRun(run: { score: number; distance: number }): number;
export function earnedCar(progress: Progression, car: CarId): boolean;
export function canDriveCar(progress: Progression, car: CarId): boolean;
export function awardProgress(progress: Progression, run: { score: number; distance: number }): { progress: Progression; gain: number; unlocked: CarId[] };
export function nextUnlock(progress: Progression): [CarId, number] | null;
