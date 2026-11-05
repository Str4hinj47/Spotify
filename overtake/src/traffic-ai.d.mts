export interface AICar { s: number; offset: number; speed: number; dir: 1 | -1; length: number; width: number; ai?: { cruise: number; braking: boolean; accel: number }; braking?: boolean; }
export interface Hazard { kind: 'traffic' | 'oncoming'; distance: number; ttc: number; speed: number; }
export function createTrafficAI(cruise: number): { cruise: number; braking: boolean; accel: number };
export function findLeader<T extends AICar>(car: T, traffic: T[], laneTolerance?: number): T | null;
export function stepTraffic(car: AICar, leader: AICar | null, dt: number, grip?: number): boolean;
export function hazardAhead(player: { s: number; offset: number; speed: number; width: number; length: number }, traffic: AICar[]): Hazard | null;
