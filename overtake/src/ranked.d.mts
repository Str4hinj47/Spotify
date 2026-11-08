export type ScenarioId = import('./circuit.mjs').TrackId;
export interface RankedScenario {id:ScenarioId;title:string;kicker:string;trackId:ScenarioId;kind:'race'|'drift';distance:number;laps:number;multiplier:number;objective:string;}
export interface Rank { id: string; name: string; min: number; color: string; glow: string; }
export interface RankedState { version: 1; points: number; attempts: number; scenarios: Partial<Record<ScenarioId | 'slipstream' | 'needle' | 'gauntlet', {completions:number; bestTime:number | null; bestMedal:'bronze'|'silver'|'gold'|null}>>; }
export interface RankInfo { rank: Rank; index:number; next:Rank|null; progress:number; points:number; }
export interface RankedOutcome { delta:number; medal:'bronze'|'silver'|'gold'|null; success:boolean; eligible:boolean; }
export interface RankChange { state:RankedState; outcome:RankedOutcome; before:RankInfo; after:RankInfo; delta:number; }
export const RANKS: readonly Rank[];
export const SCENARIOS: readonly RankedScenario[];
export const RANKED_STORAGE_KEY: string;
export function getScenario(id: unknown): RankedScenario;
export function emptyRanked(): RankedState;
export function sanitizeRanked(raw:unknown): RankedState;
export function rankFor(points:number): RankInfo;
export function rankedOutcome(run: import('./run.mjs').RunState, devRun?:boolean): RankedOutcome;
export function applyRankedResult(raw:unknown, run: import('./run.mjs').RunState, devRun?:boolean): RankChange;
