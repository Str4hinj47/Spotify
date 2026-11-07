import { CAR_CONTENT } from './content/cars.mjs';
export type CarId = (typeof CAR_CONTENT)[number]['id'];
export type TruckId = 'semi' | 'kraz';
export const TRAFFIC_ONLY = [
  { id: 'camry', name: 'Toyota Camry' },
  { id: 'mercedes-560', name: 'Mercedes-Benz 560 SEL' },
  { id: 'range-rover', name: 'Range Rover Sport' },
] as const;
export type TrafficOnlyId = (typeof TRAFFIC_ONLY)[number]['id'];
export type TrafficId = CarId | TruckId | TrafficOnlyId;
export function isPlayableCar(id: TrafficId): id is CarId { return CARS.some(car => car.id === id); }
export const TRUCKS: { id: TruckId; name: string }[] = [
  { id: 'semi', name: 'Tractor trailer' }, { id: 'kraz', name: 'KrAZ truck' },
];

export interface CarSpec {
  id: CarId;
  name: string;
  maker: string;
  tagline: string;
  klass: string;
  maxSpeed: number; // m/s
  accel: number; // m/s^2
  handling: number; // lane-change responsiveness
  bonus: number; // score multiplier
  stats: { speed: number; handling: number; bonus: number };
  color: string;
  credit?: string;
  price: number;
  unlockTier: number;
  rarity: string;
  trafficCruise: number; // m/s
  orientationDegrees: number;
  collection: string;
  physics: VehiclePhysics;
}

export interface VehiclePhysics {
  grip: number;          // peak lateral mu
  brake: number;         // m/s^2 full brake
  wheelbase: number;     // m
  maxSteer: number;      // rad at standstill
  understeer: number;    // speed^2 gradient
  yawResponse: number;   // 1/s
  steerResponse: number; // 1/s
  drag: number;          // quadratic drag coefficient
}

export const CARS: readonly CarSpec[] = CAR_CONTENT;


export const TRAFFIC_COLORS = [
  0xb8bec6, 0x20252e, 0xa51f28, 0x245eac, 0xe4e7ed,
  0x32734a, 0xd37a22, 0x633c85, 0xbca32a, 0x318986,
];

export { PAINT_COLORS } from './content/cosmetics.mjs';

export function getCar(id: CarId): CarSpec {
  const car = CARS.find((c) => c.id === id);
  if (!car) throw new Error(`Unknown car ${id}`);
  return car;
}
