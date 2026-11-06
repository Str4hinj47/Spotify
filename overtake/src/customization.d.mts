export type PartOption = 'stock' | 'street' | 'touring' | 'sport' | 'track';
export type BodyPart = 'front' | 'rear' | 'skirts' | 'spoiler' | 'exhaust';
export type FinishKey = 'frontFinish' | 'rearFinish' | 'skirtsFinish' | 'spoilerFinish' | 'exhaustFinish';
export interface Customization {
  front:PartOption; rear:PartOption; skirts:PartOption; spoiler:PartOption; exhaust:PartOption|'flame';
  frontFinish:'standard'|'carbon'; rearFinish:'standard'|'carbon'; skirtsFinish:'standard'|'carbon'; spoilerFinish:'standard'|'carbon'; exhaustFinish:'standard'|'carbon';
  paintScheme:'single'|'upper'|'lower'; secondaryColor:string; secondaryFinish:'paint'|'carbon';
  livery:'none'|'stripe'|'race'; liveryColor:string; underglow:boolean; glowColor:string;
}
export const BODY_PARTS: readonly BodyPart[];
export const PART_OPTIONS: readonly PartOption[];
export const DEFAULT_CUSTOMIZATION: Readonly<Customization>;
export function sanitizeCustomization(value: unknown): Customization;
export function sanitizeCustomizations(value: unknown, ids: readonly string[]): Record<string, Customization>;
