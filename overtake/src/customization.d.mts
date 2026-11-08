export type PartOption = 'stock' | 'street' | 'touring' | 'sport' | 'track';
export type GolfRearOption = 'golf-r32' | 'golf-clean' | 'golf-diffuser';
export type GolfPartOption = GolfRearOption | 'golf-wide' | 'golf-splitter' | 'golf-superwide' | 'golf-wing' | 'golf-quad-flame' | 'golf-vented' | 'golf-rally' | 'golf-roof-scoop' | 'golf-roof-vents';
export type MercedesPartOption = 'mercedes-aero' | 'mercedes-splitter' | 'mercedes-clean' | 'mercedes-diffuser' | 'mercedes-wide';
export type BodyPart = 'front' | 'rear' | 'skirts' | 'spoiler' | 'exhaust' | 'hood' | 'roof';
export type FinishKey = 'frontFinish' | 'rearFinish' | 'skirtsFinish' | 'spoilerFinish' | 'exhaustFinish' | 'hoodFinish' | 'roofFinish';
export interface Customization {
  front:PartOption|'golf-wide'|'golf-splitter'|'mercedes-aero'|'mercedes-splitter'; rear:PartOption|GolfRearOption|'mercedes-clean'|'mercedes-diffuser'; skirts:PartOption|'golf-superwide'|'mercedes-wide'; spoiler:PartOption|'golf-wing'; exhaust:PartOption|'flame'|'golf-quad-flame'; hood:PartOption|'golf-vented'|'golf-rally'; roof:PartOption|'golf-roof-scoop'|'golf-roof-vents';
  frontFinish:'standard'|'carbon'; rearFinish:'standard'|'carbon'; skirtsFinish:'standard'|'carbon'; spoilerFinish:'standard'|'carbon'; exhaustFinish:'standard'|'carbon'; hoodFinish:'standard'|'carbon'; roofFinish:'standard'|'carbon';
  paintScheme:'single'|'upper'|'lower'|'roof-only'; secondaryColor:string; secondaryFinish:'paint'|'carbon';
  afterfire:boolean; removePlates:boolean;
  rim:string; rimColor:string; tireWidth:'narrow'|'standard'|'wide'; tireProfile:'low'|'standard'|'thick'; flameColor:string; headlights:'stock'|'smoked'|'halo'; mirrors:'stock'|'sport'|'carbon';
  livery:(typeof import('./content/cosmetics.mjs').LIVERY_OPTIONS)[number]['id']; liveryColor:string; underglow:boolean; glowColor:string;
}
export const BODY_PARTS: readonly BodyPart[];
export const PAINT_SCHEMES: readonly Customization['paintScheme'][];
export const PART_OPTIONS: readonly PartOption[];
export const GOLF_REAR_OPTIONS: readonly GolfRearOption[];
export const GOLF_PART_OPTIONS: Readonly<Partial<Record<BodyPart, readonly GolfPartOption[]>>>;
export const MERCEDES_PART_OPTIONS: Readonly<Partial<Record<BodyPart, readonly MercedesPartOption[]>>>;
export const DEFAULT_CUSTOMIZATION: Readonly<Customization>;
export function sanitizeCustomization(value: unknown): Customization;
export function sanitizeCustomizations(value: unknown, ids: readonly string[]): Record<string, Customization>;
