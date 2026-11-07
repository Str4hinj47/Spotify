export type BiomeId = 'meadow' | 'forest' | 'alpine' | 'desert' | 'urban';
export interface BiomeParams {
  label: string; a: BiomeId; b: BiomeId; blend: number;
  ground: number; shoulder: number; fog: number; tree: number; conifer: number;
  rock: number; building: number; mountain: number;
  treeDensity: number; coniferRatio: number; rockDensity: number;
  buildingDensity: number; mountainScale: number; temperature: number;
}
export const BIOME_IDS: BiomeId[];
export const BIOME_PARAMS: Record<BiomeId, Omit<BiomeParams, 'label' | 'a' | 'b' | 'blend'> & { label: string }>;
export function biomeSegment(s: number): { a: BiomeId; b: BiomeId; blend: number; segment: number; frac: number };
export function biomeWeights(s: number): Record<BiomeId, number>;
export function dominantBiome(s: number): BiomeId;
export function biomeParams(s: number): BiomeParams;
export function biomeContinuity(s: number, step?: number): number;
