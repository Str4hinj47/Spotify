export interface AICar { id: string; s: number; offset: number; speed: number; dir: 1 | -1; length: number; width: number; ai: TrafficAI; braking?: boolean; }
export interface TrafficAI { cruise: number; braking: boolean; accel: number; pass?: { truck: AICar; phase: 'out' | 'passing' | 'back' } | null; }
export interface Hazard { kind: 'traffic' | 'oncoming'; distance: number; ttc: number; speed: number; }
export function createTrafficAI(cruise: number): TrafficAI;
export function findLeader<T extends AICar>(car: T, traffic: T[], laneTolerance?: number): T | null;
export function stepTraffic(car: AICar, leader: AICar | null, dt: number, grip?: number): boolean;
export function hazardAhead(player: { s: number; offset: number; speed: number; width: number; length: number }, traffic: AICar[]): Hazard | null;
export const TRAFFIC_CRUISE: Readonly<Record<string, number>>;
export function isTruck(id: string): boolean;
export function trafficCruise(id: string, random?: () => number): number;
export function chooseTruck(score: number, traffic: AICar[], s: number, random?: () => number): 'semi' | 'kraz' | null;
export function canOvertakeTruck(car: AICar, truck: AICar | null, traffic: AICar[], player: {s:number; maxSpeed:number} | null): boolean;
export function startOvertake(car: AICar, truck: AICar): void;
export function stepOvertake(car: AICar, dt: number, ownLane?: number, oppositeLane?: number): boolean;
