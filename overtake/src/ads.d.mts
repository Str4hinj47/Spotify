export interface AdStatus {
  ready: boolean;
  environment: string;
  adsDisabled: boolean;
  adblock: boolean;
  platformMuted: boolean;
  inAd: boolean;
  runsCompleted: number;
  demo: boolean;
  error: string | null;
}
export interface AdResult { ok: boolean; reason: string; code?: string | null; cooldown?: number }
export interface AdHooks {
  onEvent?: (event: { type: string; kind?: string; placement?: string; ok?: boolean; code?: string | null; settings?: unknown }) => void;
}
export interface AdService {
  status(): AdStatus;
  init(sdk?: unknown): Promise<AdStatus>;
  onStatus(listener: (status: AdStatus) => void): () => void;
  canOfferRewarded(placement: string): boolean;
  cooldownLeft(placement: string): number;
  readonly platformMuted: boolean;
  readonly adblock: boolean;
  readonly adsDisabled: boolean;
  readonly ready: boolean;
  readonly inAd: boolean;
  gameplayStart(): void;
  gameplayStop(): void;
  happytime(): void;
  runCompleted(): void;
  shouldOfferMidgame(): boolean;
  requestMidgame(): Promise<AdResult>;
  requestRewarded(placement: string): Promise<AdResult>;
  canShowBanner(): boolean;
  showBanner(containerId: string): Promise<boolean>;
  hideBanner(containerId: string): void;
}
export function createAdService(options?: {
  sdk?: unknown;
  demo?: boolean;
  enabled?: boolean;
  now?: () => number;
  storage?: Storage | null;
  hooks?: AdHooks;
}): AdService;
export const FREE_GEMS: number;
export const REWARDED_COOLDOWNS: Readonly<Record<string, number>>;
