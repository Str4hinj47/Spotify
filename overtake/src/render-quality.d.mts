export type GraphicsQuality = 'performance' | 'balanced' | 'sharp';
export const GRAPHICS_QUALITIES: readonly GraphicsQuality[];
export function sanitizeGraphicsQuality(value: unknown): GraphicsQuality;
export function vehiclePixelRatio(devicePixelRatio: number, width: number, height: number, coarsePointer: boolean, maxRenderSize?: number, quality?: GraphicsQuality): number;
