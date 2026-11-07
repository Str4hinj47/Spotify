export type PartOption = 'stock' | 'street' | 'touring' | 'sport' | 'rally' | 'gt' | 'track' | 'wide' | 'titanium';
export type PaintFinish = 'gloss' | 'metallic' | 'pearlescent' | 'matte' | 'satin';
export type LiveryOption = 'none' | 'stripe' | 'race' | 'camo' | 'fade' | 'checker' | 'slash';
export type BodyPart = 'front' | 'rear' | 'skirts' | 'spoiler' | 'exhaust';
export type FinishKey = 'frontFinish' | 'rearFinish' | 'skirtsFinish' | 'spoilerFinish' | 'exhaustFinish';
export interface Customization {
  front:PartOption; rear:PartOption; skirts:PartOption; spoiler:PartOption; exhaust:PartOption|'flame';
  frontFinish:'standard'|'carbon'; rearFinish:'standard'|'carbon'; skirtsFinish:'standard'|'carbon'; spoilerFinish:'standard'|'carbon'; exhaustFinish:'standard'|'carbon';
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
