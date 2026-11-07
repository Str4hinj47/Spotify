import type { RunMode, RunSummary, Medal } from './run.mjs';
export interface RunRecord extends RunSummary { mode: RunMode; }
export interface ModeRecords { bestScore: number; bestDistance: number; runs: number; recent: RunRecord[]; }
export interface Records { version: 2; modes: Record<RunMode, ModeRecords>; }
export function emptyRecords(): Records;
export function sanitizeRecords(raw: unknown): Records;
export function recordRun(records: Records, summary: RunSummary): { records: Records; entry: RunRecord; newBest: boolean; medal: Medal };
export function bestFor(records: Records, mode: RunMode): number;
