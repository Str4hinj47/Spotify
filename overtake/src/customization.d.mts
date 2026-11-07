export type PartOption = 'stock' | 'street' | 'touring' | 'sport' | 'rally' | 'gt' | 'track' | 'wide' | 'titanium';
export type PaintFinish = 'gloss' | 'metallic' | 'pearlescent' | 'matte' | 'satin';
export type LiveryOption = 'none' | 'stripe' | 'race' | 'camo' | 'fade' | 'checker' | 'slash' | 'sunset' | 'aurora' | 'prism' | 'vapor' | 'midnight' | 'flames' | 'inferno' | 'ember' | 'dragon' | 'lightning' | 'waves' | 'stars' | 'tribal';
export type BodyPart = 'front' | 'rear' | 'skirts' | 'spoiler' | 'exhaust' | 'hood' | 'roof';
export type FinishKey = 'frontFinish' | 'rearFinish' | 'skirtsFinish' | 'spoilerFinish' | 'exhaustFinish' | 'hoodFinish' | 'roofFinish';
export interface Customization {
  front:PartOption; rear:PartOption; skirts:PartOption; spoiler:PartOption; exhaust:PartOption|'flame'|'quadflame'; hood:PartOption; roof:PartOption;
  frontFinish:'standard'|'carbon'; rearFinish:'standard'|'carbon'; skirtsFinish:'standard'|'carbon'; spoilerFinish:'standard'|'carbon'; exhaustFinish:'standard'|'carbon'; hoodFinish:'standard'|'carbon'; roofFinish:'standard'|'carbon';
  paintScheme:'single'|'upper'|'lower'; secondaryColor:string; secondaryFinish:'paint'|'carbon';
  paintFinish:PaintFinish; pearlColor:string;
  livery:LiveryOption; liveryColor:string; underglow:boolean; glowColor:string;
}
export const BODY_PARTS: readonly BodyPart[];
export const PART_OPTIONS: readonly PartOption[];
export const PAINT_FINISHES: readonly PaintFinish[];
export const LIVERY_OPTIONS: readonly LiveryOption[];
export const DEFAULT_CUSTOMIZATION: Readonly<Customization>;
export function sanitizeCustomization(value: unknown): Customization;
export function sanitizeCustomizations(value: unknown, ids: readonly string[]): Record<string, Customization>;
