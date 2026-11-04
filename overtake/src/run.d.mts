export type RunMode = 'endless' | 'rush';
export type Medal = 'bronze' | 'silver' | 'gold' | null;
export interface RunContract { id: string; title: string; desc: string; metric: string; target: number; reward: number; boost: number; }
export interface RunState {
  mode: RunMode; seed: number; elapsed: number; timeLeft: number | null;
  distance: number; score: number; combo: number; bestCombo: number;
  overtakes: number; nearMisses: number; oncomingDodges: number;
  topSpeed: number; highSpeedTime: number;
  boostCharge: number; boostActive: boolean; boostHeld: boolean; boostUsed: number;
  contracts: RunContract[]; contractIndex: number; contractBaseline: number; contractsDone: number;
  allContractsSent?: boolean; finished: boolean; reason: string | null;
}
export interface RunEvent { type: string; contract?: RunContract; points?: number; mult?: number; reason?: string; }
export interface RunSummary { mode: RunMode; car: string; score: number; distance: number; overtakes: number; nearMisses: number; oncomingDodges: number; topSpeed: number; contractsDone: number; elapsed: number; medal: Medal; reason: string | null; date: number; }
export const RUN_MODES: Record<RunMode, { id: RunMode; label: string; duration: number | null; tagline: string; medals: { bronze: number; silver: number; gold: number } }>;
export const BOOST: { start: number; min: number; drain: number; accel: number; extraSpeed: number; overtake: number; near: number; oncoming: number; contract: number; slipstream: number };
export function mulberry32(seed: number): () => number;
export function createRun(mode?: RunMode, seed?: number): RunState;
export function medalFor(mode: RunMode, score: number): Medal;
export function contractProgress(run: RunState): { contract: RunContract | null; value: number; target: number; ratio: number };
export function tickRun(run: RunState, dt: number, speed: number, pedals?: { throttle: boolean; brake: boolean }): RunEvent[];
export function registerPass(run: RunState, kind: 'same' | 'oncoming', near: boolean, carBonus?: number): { points: number; events: RunEvent[] };
export function addSlipstream(run: RunState, dt: number): void;
export function finishRun(run: RunState, reason: string): void;
export function runSummary(run: RunState, carId: string): RunSummary;
