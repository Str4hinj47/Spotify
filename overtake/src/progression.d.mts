import type { CarId } from './catalog';
export type Upgrade = 'engine' | 'tires' | 'brakes';
export type UpgradeLevels = Record<Upgrade, number>;
export interface Progression { version: 2; money: number; dev: boolean; owned: CarId[]; upgrades: Partial<Record<CarId, UpgradeLevels>>; tunes: Partial<Record<CarId, string[]>>; }
export const CAR_PRICES: Readonly<Record<CarId, number>>;
export const UPGRADE_PRICES: Readonly<Record<Upgrade, readonly number[]>>;
export const TUNE_PRICES: Readonly<Record<string, number>>;
export function emptyProgression(): Progression;
export function sanitizeProgression(raw: unknown): Progression;
export function payoutForScore(score: number): number;
export function earnedCar(progress: Progression, car: CarId): boolean;
export function canDriveCar(progress: Progression, car: CarId): boolean;
export function awardProgress(progress: Progression, run: { score: number }): { progress: Progression; gain: number };
export function buyCar(progress: Progression, car: CarId): { progress: Progression; ok: boolean };
export function buyUpgrade(progress: Progression, car: CarId, key: Upgrade): { progress: Progression; ok: boolean };
export function tunePrice(key: string, value: string): number;
export function buyTune(progress: Progression, car: CarId, key: string, value: string): { progress: Progression; ok: boolean };
export function upgradeLevels(progress: Progression, car: CarId): UpgradeLevels;
export function effectiveUpgrades(progress: Progression, car: CarId): UpgradeLevels;
