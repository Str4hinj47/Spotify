import type { CarSpec } from './catalog';
export type UpgradeLevels = { engine:number; tires:number; brakes:number };
export function vehicleParameters(spec:CarSpec, upgrades:UpgradeLevels, width:string, surface?:number): CarSpec['physics'] & { accel:number; maxSpeed:number; surfaceGrip:number };
export function performanceStats(spec:CarSpec, upgrades:UpgradeLevels, width:string): { topSpeed:number; sprint:number|null; brakingDistance:number; grip:number; bonus:number };
