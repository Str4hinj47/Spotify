// CrazyGames ad integration. The platform only permits ads requested through
// its SDK, so every placement goes through this service. Outside CrazyGames
// (or when ads are disabled, blocked or unfilled) the service resolves
// "unavailable" and the UI hides the offers instead of showing dead buttons.
const MINUTE = 60_000;

export const FREE_GEMS = 3;
export const REWARDED_COOLDOWNS = Object.freeze({ freeGems: 10 * MINUTE, doubleRewards: 0 });
const STORAGE_KEY = 'overtake-ad-state-v1';

const codeOf = error => String(error?.code ?? error?.message ?? error ?? 'other');

/** @param {{sdk?: any, demo?: boolean, now?: () => number, storage?: Storage|null, hooks?: object}} options */
export function createAdService({ sdk = null, demo = false, enabled = true, now = () => Date.now(), storage = null, hooks = {} } = {}) {
  const state = {
    ready: false,
    sdk: sdk,
    environment: 'none',
    adsDisabled: false,
    adblock: false,
    platformMuted: false,
    inAd: false,
    lastVideoAt: 0,
    lastRewardedAt: {},
    runsCompleted: 0,
    error: null,
    demo,
    enabled,
    initialized: false,
  };
  const listeners = new Set();
  const emit = () => { for (const listener of listeners) { try { listener(status()); } catch { /* listeners must not break ads */ } } };
  function readCooldowns() {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved === 'object') state.lastRewardedAt = { ...saved };
    } catch { /* storage is optional */ }
  }
  function writeCooldowns() {
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(state.lastRewardedAt)); } catch { /* ignore */ }
  }
  readCooldowns();

  function status() {
    return {
      ready: state.ready,
      environment: state.environment,
      adsDisabled: state.adsDisabled,
      adblock: state.adblock,
      platformMuted: state.platformMuted,
      inAd: state.inAd,
      runsCompleted: state.runsCompleted,
      demo: state.demo,
      error: state.error,
    };
  }

  function adblocked() { return state.adblock || state.adsDisabled; }

  /** Can this rewarded placement be offered right now? */
  function canOfferRewarded(placement) {
    if (!state.ready || adblocked() || state.inAd) return false;
    if (state.demo) return true;
    return cooldownLeft(placement) <= 0;
  }

  function cooldownLeft(placement) {
    if (!state.ready || adblocked()) return 0;
    const until = Number(state.lastRewardedAt[placement] ?? 0) + (REWARDED_COOLDOWNS[placement] ?? 0);
    return Math.max(0, until - now());
  }

  function noteError(error) {
    const code = codeOf(error);
    if (code === 'adsDisabled') state.adsDisabled = true;
    if (code === 'adblock') state.adblock = true;
    state.error = code;
    emit();
    return code;
  }

  function safe(fn, fallback = null) {
    try { return fn(); } catch (error) { noteError(error); return fallback; }
  }

  function emitMessage(type, payload) {
    try { hooks.onEvent?.({ type, ...payload }); } catch { /* ignore */ }
  }

  function requestAd(kind, placement = '') {
    if (!state.ready || adblocked()) return Promise.resolve({ ok: false, reason: 'unavailable', code: state.adsDisabled ? 'adsDisabled' : state.adblock ? 'adblock' : 'notReady' });
    if (state.inAd) return Promise.resolve({ ok: false, reason: 'busy', code: 'busy' });
    state.inAd = true;
    emitMessage('request', { kind, placement });
    emit();
    return new Promise(resolve => {
      let settled = false;
      let timer = null;
      const finish = (ok, code) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        state.inAd = false;
        if (ok) {
          state.lastVideoAt = now();
          if (kind === 'rewarded' && placement) { state.lastRewardedAt[placement] = now(); writeCooldowns(); }
        }
        emitMessage('end', { kind, placement, ok, code: code ?? null });
        emit();
        resolve({ ok, reason: ok ? 'finished' : 'error', code: code ?? null });
      };
      const callbacks = {
        adStarted: () => { emitMessage('play', { kind, placement }); },
        adFinished: () => finish(true),
        adError: (error) => { const code = noteError(error); finish(false, code); },
      };
      try {
        if (state.demo) {
          emitMessage('simulate', { kind, placement });
          timer = setTimeout(() => finish(true), kind === 'rewarded' ? 2200 : 1600);
          emitMessage('play', { kind, placement });
          return;
        }
        // 120 s safety net: an SDK callback should always beat this, but a
        // lost callback must never leave the game permanently blocked.
        timer = setTimeout(() => finish(false, 'timeout'), 120_000);
        const pending = state.sdk.ad.requestAd(kind, callbacks);
        if (pending && typeof pending.catch === 'function') pending.catch(error => finish(false, noteError(error)));
      } catch (error) {
        finish(false, noteError(error));
      }
    });
  }

  return {
    state,
    status,
    canOfferRewarded,
    cooldownLeft,
    get platformMuted() { return state.platformMuted; },
    get adblock() { return state.adblock; },
    get adsDisabled() { return state.adsDisabled; },
    get ready() { return state.ready; },
    get inAd() { return state.inAd; },
    onStatus(listener) { listeners.add(listener); return () => listeners.delete(listener); },

    async init(externalSdk = null) {
      if (externalSdk) state.sdk = externalSdk;
      if (state.initialized) return status();
      state.initialized = true;
      if (demo) { state.ready = true; state.environment = 'demo'; emit(); return status(); }
      if (!state.sdk) { emit(); return status(); }
      try {
        await state.sdk.init();
        state.ready = true;
        state.environment = String(state.sdk.environment ?? 'unknown');
        if (state.environment === 'disabled') state.adsDisabled = true;
        // Test ads from a local SDK build must never appear on the public site.
        // The SDK's own environment claim wins when the game is framed by the portal.
        if (!state.enabled && state.environment !== 'crazygames') state.adsDisabled = true;
        try { state.adblock = !!(await state.sdk.ad?.hasAdblock?.()); } catch { /* optional */ }
        try {
          state.platformMuted = !!state.sdk.game?.settings?.muteAudio;
          state.sdk.game?.addSettingsChangeListener?.(settings => {
            state.platformMuted = !!settings?.muteAudio;
            emitMessage('settings', { settings });
            emit();
          });
        } catch { /* settings are optional */ }
      } catch (error) {
        state.error = String(error?.message ?? error ?? 'init');
        state.ready = false;
      }
      emit();
      return status();
    },

    gameplayStart() {
      if (!state.ready || state.demo) return;
      safe(() => state.sdk.game?.gameplayStart?.());
    },
    gameplayStop() {
      if (!state.ready || state.demo) return;
      safe(() => state.sdk.game?.gameplayStop?.());
    },
    happytime() {
      if (!state.ready || state.demo) return;
      safe(() => state.sdk.game?.happytime?.());
    },
    runCompleted() { state.runsCompleted += 1; },

    /** A midgame break is only worth offering after a few completed runs; the
     * SDK's own three-minute frequency cap protects the rest. */
    shouldOfferMidgame() {
      return state.ready && !adblocked() && !state.inAd && state.runsCompleted >= 2 && now() - state.lastVideoAt > 120_000;
    },
    requestMidgame() {
      if (!state.ready || adblocked()) return Promise.resolve({ ok: false, reason: 'unavailable' });
      return requestAd('midgame', 'betweenRuns');
    },
    requestRewarded(placement) {
      if (state.inAd) return Promise.resolve({ ok: false, reason: 'busy', code: 'busy' });
      if (!canOfferRewarded(placement)) return Promise.resolve({ ok: false, reason: 'unavailable', cooldown: cooldownLeft(placement) });
      return requestAd('rewarded', placement);
    },

    canShowBanner() { return state.ready && !adblocked() && !state.inAd; },
    async showBanner(containerId) {
      if (!state.ready || adblocked() || state.demo) {
        const node = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
        if (node) node.dataset.adState = state.demo ? 'demo' : 'off';
        return state.demo && state.ready;
      }
      try {
        await state.sdk.banner.requestResponsiveBanner(containerId);
        return true;
      } catch (error) {
        noteError(error);
        const node = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
        if (node) node.dataset.adState = 'error';
        return false;
      }
    },
    hideBanner(containerId) {
      if (!state.ready || state.demo) return;
      safe(() => state.sdk.banner.clearBanner(containerId));
    },
  };
}
