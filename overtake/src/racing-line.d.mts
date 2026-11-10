export interface ReferenceLinePoint { s: number; offset: number }
export interface ReferenceLine {
  trackId: string;
  length: number;
  halfWidth: number;
  limit: number;
  samples: ReferenceLinePoint[];
}
export function referenceLine(trackId: string): ReferenceLine;
export function lineOffsetAt(line: ReferenceLine, s: number): number;
export function resampleLine(samples: readonly (readonly [number, number])[], length: number, count?: number): ReferenceLinePoint[];
