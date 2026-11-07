export type PartOption = 'stock' | 'street' | 'touring' | 'sport' | 'track';
export type BodyPart = 'front' | 'rear' | 'skirts' | 'spoiler' | 'exhaust' | 'hood' | 'roof';
export type FinishKey = 'frontFinish' | 'rearFinish' | 'skirtsFinish' | 'spoilerFinish' | 'exhaustFinish' | 'hoodFinish' | 'roofFinish';
export interface Customization {
  front:PartOption; rear:PartOption; skirts:PartOption; spoiler:PartOption; exhaust:PartOption|'flame'; hood:PartOption; roof:PartOption;
  frontFinish:'standard'|'carbon'; rearFinish:'standard'|'carbon'; skirtsFinish:'standard'|'carbon'; spoilerFinish:'standard'|'carbon'; exhaustFinish:'standard'|'carbon'; hoodFinish:'standard'|'carbon'; roofFinish:'standard'|'carbon';
  paintScheme:'single'|'upper'|'lower'; secondaryColor:string; secondaryFinish:'paint'|'carbon';
  rim:string; rimColor:string; tireWidth:'narrow'|'standard'|'wide';
  livery:(typeof import('./content/cosmetics.mjs').LIVERY_OPTIONS)[number]['id']; liveryColor:string; underglow:boolean; glowColor:string;
}
export const BODY_PARTS: readonly BodyPart[];
export const PART_OPTIONS: readonly PartOption[];
export const DEFAULT_CUSTOMIZATION: Readonly<Customization>;
export function sanitizeCustomization(value: unknown): Customization;
export function sanitizeCustomizations(value: unknown, ids: readonly string[]): Record<string, Customization>;
