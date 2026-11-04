export interface CoachState { state: 'clear' | 'go' | 'wait' | 'passing' | 'return' | 'danger'; label: string; seconds: number | null; }
export function assessOvertake(player: { s: number; offset: number; speed: number; length?: number }, traffic: Array<{ s: number; offset: number; speed: number; dir: 1 | -1; length?: number }>, opts?: { margin?: number; lookAhead?: number }): CoachState;
