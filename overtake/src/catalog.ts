export type CarId = 'golf' | 'mercedes' | 'audi' | 'mustang' | 'ferrari' | 'r8' | 'challenger';
export type TruckId = 'semi' | 'kraz';
export type TrafficId = CarId | TruckId;
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

export const CARS: CarSpec[] = [
  {
    id: 'golf',
    name: 'Golf MK4 GTI',
    maker: 'Volkswagen',
    tagline: 'The hot-hatch original. Small, nimble, always up for a gap.',
    klass: 'Hot hatch',
    maxSpeed: 54,
    accel: 9.5,
    handling: 7.5,
    bonus: 1.0,
    stats: { speed: 3, handling: 5, bonus: 3 },
    color: '#9fb0bf',
    credit: 'Jay-Artist · CC BY 3.0',
    physics: { grip: 1.02, brake: 10.5, wheelbase: 2.51, maxSteer: 0.52, understeer: 0.005, yawResponse: 7.0, steerResponse: 7.5, drag: 0.00075 },
  },
  {
    id: 'mercedes',
    name: 'S 63 AMG',
    maker: 'Mercedes-Benz',
    tagline: 'Autobahn royalty. Effortless pace with a velvet hammer.',
    klass: 'Super sedan',
    maxSpeed: 60,
    accel: 8.5,
    handling: 5.5,
    bonus: 1.1,
    stats: { speed: 4, handling: 3, bonus: 4 },
    color: '#1c2129',
    credit: 'User-provided Drive asset',
    physics: { grip: 1.05, brake: 11.5, wheelbase: 3.16, maxSteer: 0.48, understeer: 0.002, yawResponse: 5.5, steerResponse: 6.0, drag: 0.00080 },
  },
  {
    id: 'audi',
    name: 'RS 6 Avant',
    maker: 'Audi',
    tagline: 'The long-roof missile. Family wagon, supercar urgency.',
    klass: 'Performance wagon',
    maxSpeed: 61,
    accel: 9.0,
    handling: 6.5,
    bonus: 1.1,
    stats: { speed: 4, handling: 4, bonus: 4 },
    color: '#7d8a93',
    credit: 'User-provided Drive asset',
    physics: { grip: 1.08, brake: 11.5, wheelbase: 2.91, maxSteer: 0.50, understeer: 0.0035, yawResponse: 6.5, steerResponse: 7.0, drag: 0.00078 },
  },
  {
    id: 'mustang',
    name: 'Mustang GT',
    maker: 'Ford',
    tagline: 'American muscle. Loud, proud, and hungry for the left lane.',
    klass: 'Muscle car',
    maxSpeed: 58,
    accel: 9.8,
    handling: 5.8,
    bonus: 1.0,
    stats: { speed: 4, handling: 3, bonus: 3 },
    color: '#1f5fd0',
    credit: 'User-provided Drive asset',
    physics: { grip: 1.00, brake: 10.8, wheelbase: 2.72, maxSteer: 0.50, understeer: 0.003, yawResponse: 6.8, steerResponse: 7.2, drag: 0.00082 },
  },
  {
    id: 'ferrari',
    name: '458 Italia',
    maker: 'Ferrari',
    tagline: 'Maranello precision. The fastest way to turn traffic into points.',
    klass: 'Supercar',
    maxSpeed: 66,
    accel: 11.0,
    handling: 8.0,
    bonus: 1.2,
    stats: { speed: 5, handling: 5, bonus: 5 },
    color: '#d40f1e',
    credit: 'RainerS · CC BY 3.0',
    physics: { grip: 1.18, brake: 13.0, wheelbase: 2.65, maxSteer: 0.46, understeer: 0.002, yawResponse: 9.0, steerResponse: 9.0, drag: 0.00068 },
  },
  {
    id: 'r8', name: 'R8', maker: 'Audi', tagline: 'Mid-engine balance and supercar pace.', klass: 'Supercar',
    maxSpeed: 65, accel: 10.6, handling: 8.0, bonus: 1.2, stats: { speed: 5, handling: 5, bonus: 5 },
    color: '#b3bbc3', credit: 'User-provided Drive asset',
    physics: { grip: 1.15, brake: 12.8, wheelbase: 2.65, maxSteer: 0.46, understeer: 0.002, yawResponse: 8.5, steerResponse: 8.5, drag: 0.0007 },
  },
  {
    id: 'challenger', name: 'Challenger', maker: 'Dodge', tagline: 'Big V8 attitude, built for the open road.', klass: 'Muscle car',
    maxSpeed: 59, accel: 9.6, handling: 5.4, bonus: 1.05, stats: { speed: 4, handling: 3, bonus: 3 },
    color: '#3f7843', credit: 'User-provided Drive asset',
    physics: { grip: 0.98, brake: 10.6, wheelbase: 2.95, maxSteer: 0.48, understeer: 0.003, yawResponse: 6, steerResponse: 6.5, drag: 0.00085 },
  },
];


export const TRAFFIC_COLORS = [
  0xb8bec6, 0x20252e, 0xa51f28, 0x245eac, 0xe4e7ed,
  0x32734a, 0xd37a22, 0x633c85, 0xbca32a, 0x318986,
];

export const PAINT_COLORS: { name: string; hex: string }[] = [
  { name: 'Rosso', hex: '#d40f1e' },
  { name: 'Nero', hex: '#101216' },
  { name: 'Bianco', hex: '#e8eaee' },
  { name: 'Argento', hex: '#9fb0bf' },
  { name: 'Blu', hex: '#1f5fd0' },
  { name: 'Giallo', hex: '#f2c230' },
  { name: 'Verde', hex: '#1f6f43' },
  { name: 'Arancio', hex: '#ff7a1a' },
  { name: 'Viola', hex: '#5b2a86' },
  { name: 'Grigio', hex: '#4a505a' },
  { name: 'Midnight Pearl', hex: '#17203a' },
  { name: 'British Green', hex: '#0d3b2e' },
  { name: 'Candy Apple', hex: '#8f0f22' },
  { name: 'Solar Gold', hex: '#c9920e' },
  { name: 'Ultraviolet', hex: '#3b1470' },
  { name: 'Ice Blue', hex: '#a8d8e8' },
  { name: 'Desert Sand', hex: '#c2a878' },
  { name: 'Hot Pink', hex: '#e83e8c' },
  { name: 'Stealth', hex: '#23262b' },
  { name: 'Lime Volt', hex: '#aacc00' },
];

export function getCar(id: CarId): CarSpec {
  const car = CARS.find((c) => c.id === id);
  if (!car) throw new Error(`Unknown car ${id}`);
  return car;
}
