export interface WorldClock { hour: number; speed: number; running: boolean; }
export const DAY_LENGTH_SECONDS: number;
export function createClock(hour?: number, speed?: number, running?: boolean): WorldClock;
export function stepClock(clock: WorldClock, dt: number): WorldClock;
export function sunAngle(hour: number): number;
export function dayFactor(hour: number): number;
export function formatHour(hour: number): string;
