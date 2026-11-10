import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdService, FREE_GEMS, REWARDED_COOLDOWNS } from '../src/ads.mjs';

function fakeSdk(overrides = {}) {
  const calls = [];
  const listeners = [];
  const sdk = {
    environment: 'crazygames',
    init: async () => { calls.push(['init']); },
    game: {
      settings: { muteAudio: false },
      gameplayStart: () => calls.push(['gameplayStart']),
      gameplayStop: () => calls.push(['gameplayStop']),
      happytime: () => calls.push(['happytime']),
      addSettingsChangeListener: (fn) => listeners.push(fn),
    },
    ad: {
      hasAdblock: async () => false,
      requestAd: (kind, cb) => { calls.push(['requestAd', kind]); sdk.lastCallbacks = cb; sdk.lastKind = kind; },
    },
    banner: {
      requestResponsiveBanner: async (id) => calls.push(['banner', id]),
      clearBanner: (id) => calls.push(['clearBanner', id]),
    },
    ...overrides,
  };
  return { sdk, calls, listeners };
}

test('without an SDK every ad placement stays unavailable', async () => {
  const ads = createAdService();
  const status = await ads.init();
  assert.equal(status.ready, false);
  assert.equal(ads.canOfferRewarded('freeGems'), false);
  assert.equal((await ads.requestRewarded('freeGems')).ok, false);
});

test('init reads platform mute and adblock state, and forwards gameplay events', async () => {
  const { sdk, calls, listeners } = fakeSdk();
  sdk.game.settings.muteAudio = true;
  sdk.ad.hasAdblock = async () => true;
  const ads = createAdService({ sdk });
  const status = await ads.init();
  assert.equal(status.ready, true);
  assert.equal(status.platformMuted, true);
  assert.equal(status.adblock, true);
  assert.equal(ads.canOfferRewarded('freeGems'), false);
  listeners[0]({ muteAudio: false });
  assert.equal(ads.status().platformMuted, false);
  ads.gameplayStart();
  ads.gameplayStop();
  ads.happytime();
  assert.deepEqual(calls.filter(c => c[0].startsWith('gameplay') || c[0] === 'happytime'), [
    ['gameplayStart'], ['gameplayStop'], ['happytime'],
  ]);
});

test('rewarded ads only pay out on adFinished and emit lifecycle events', async () => {
  const { sdk } = fakeSdk();
  const events = [];
  const ads = createAdService({ sdk, hooks: { onEvent: e => events.push(e) } });
  await ads.init();
  assert.equal(ads.canOfferRewarded('freeGems'), true);
  const pending = ads.requestRewarded('freeGems');
  assert.equal(ads.inAd, true);
  assert.deepEqual(events.map(e => e.type), ['request']);
  sdk.lastCallbacks.adStarted();
  assert.deepEqual(events.map(e => e.type), ['request', 'play']);
  sdk.lastCallbacks.adFinished();
  const result = await pending;
  assert.equal(result.ok, true);
  assert.equal(ads.inAd, false);
  assert.deepEqual(events.map(e => e.type), ['request', 'play', 'end']);
  assert.equal(events.at(-1).ok, true);
  assert.equal(ads.canOfferRewarded('freeGems'), false, 'cooldown starts after a successful view');
});

test('an ad error continues the game without paying or blocking', async () => {
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk });
  await ads.init();
  const pending = ads.requestRewarded('freeGems');
  sdk.lastCallbacks.adError({ code: 'unfilled' });
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'unfilled');
  assert.equal(ads.inAd, false);
  assert.equal(ads.canOfferRewarded('freeGems'), true, 'unfilled does not start a cooldown');
  assert.equal(ads.adsDisabled, false);
});

test('adsDisabled and adblock hide every offer for the rest of the session', async () => {
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk });
  await ads.init();
  const pending = ads.requestRewarded('doubleRewards');
  sdk.lastCallbacks.adError({ code: 'adsDisabled' });
  await pending;
  assert.equal(ads.adsDisabled, true);
  assert.equal(ads.canOfferRewarded('doubleRewards'), false);
  assert.equal((await ads.requestMidgame()).reason, 'unavailable');

  const blocked = fakeSdk();
  blocked.sdk.ad.hasAdblock = async () => true;
  const ads2 = createAdService({ sdk: blocked.sdk });
  await ads2.init();
  assert.equal(ads2.canOfferRewarded('freeGems'), false);
});

test('concurrent requests are rejected while one is pending', async () => {
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk });
  await ads.init();
  const first = ads.requestRewarded('freeGems');
  const second = await ads.requestRewarded('freeGems');
  assert.equal(second.reason, 'busy');
  sdk.lastCallbacks.adFinished();
  assert.equal((await first).ok, true);
});

test('free-gem cooldown is enforced and persists across sessions', async () => {
  let clock = 1_000_000;
  const saved = new Map();
  const storage = { getItem: k => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk, storage, now: () => clock });
  await ads.init();
  const pending = ads.requestRewarded('freeGems');
  sdk.lastCallbacks.adFinished();
  await pending;
  assert.equal(ads.canOfferRewarded('freeGems'), false);
  assert.equal(ads.cooldownLeft('freeGems'), REWARDED_COOLDOWNS.freeGems);
  clock += REWARDED_COOLDOWNS.freeGems + 1;
  assert.equal(ads.canOfferRewarded('freeGems'), true);

  clock += 0;
  const again = ads.requestRewarded('freeGems');
  sdk.lastCallbacks.adFinished();
  await again;
  const reloaded = createAdService({ sdk: fakeSdk().sdk, storage, now: () => clock });
  await reloaded.init();
  assert.equal(reloaded.canOfferRewarded('freeGems'), false, 'cooldown survives a reload');
  assert.ok(FREE_GEMS > 0);
});

test('double rewards has no cooldown, so each finished run can offer it once', async () => {
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk });
  await ads.init();
  for (let i = 0; i < 2; i++) {
    assert.equal(ads.canOfferRewarded('doubleRewards'), true);
    const pending = ads.requestRewarded('doubleRewards');
    sdk.lastCallbacks.adFinished();
    assert.equal((await pending).ok, true);
  }
});

test('midgame is only offered between runs and never starts a rewarded cooldown', async () => {
  let clock = 5_000_000;
  const { sdk } = fakeSdk();
  const ads = createAdService({ sdk, now: () => clock });
  await ads.init();
  assert.equal(ads.shouldOfferMidgame(), false, 'no runs completed yet');
  ads.runCompleted();
  assert.equal(ads.shouldOfferMidgame(), false);
  ads.runCompleted();
  assert.equal(ads.shouldOfferMidgame(), true);
  const pending = ads.requestMidgame();
  sdk.lastCallbacks.adFinished();
  assert.equal((await pending).ok, true);
  assert.equal(ads.canOfferRewarded('freeGems'), true);
  assert.equal(ads.shouldOfferMidgame(), false, 'a fresh video pauses further breaks');
  clock += 121_000;
  assert.equal(ads.shouldOfferMidgame(), true);
});

test('SDK exceptions resolve as errors instead of hanging', async () => {
  const { sdk } = fakeSdk();
  sdk.ad.requestAd = () => { throw new Error('boom'); };
  const ads = createAdService({ sdk });
  await ads.init();
  const result = await ads.requestRewarded('freeGems');
  assert.equal(result.ok, false);
  assert.equal(ads.inAd, false);
});

test('demo mode simulates ads without an SDK', async () => {
  const ads = createAdService({ demo: true });
  await ads.init();
  assert.equal(ads.status().environment, 'demo');
  assert.equal(ads.canOfferRewarded('freeGems'), true);
  const result = await ads.requestRewarded('doubleRewards');
  assert.equal(result.ok, true);
  assert.equal(ads.inAd, false);
});

test('ads are disabled on hosts that are not the portal or a local dev server', async () => {
  const { sdk } = fakeSdk();
  sdk.environment = 'local';
  const ads = createAdService({ sdk, enabled: false });
  const status = await ads.init();
  assert.equal(status.ready, true);
  assert.equal(status.adsDisabled, true);
  assert.equal(ads.canOfferRewarded('freeGems'), false);
  assert.equal(await ads.showBanner('cg-banner-season'), false);

  const portal = fakeSdk();
  const portalAds = createAdService({ sdk: portal.sdk, enabled: false });
  await portalAds.init();
  assert.equal(portalAds.adsDisabled, false, 'an SDK-confirmed portal environment may serve ads from a CDN host');
});

test('banners are requested responsively and cleared through the SDK', async () => {
  const { sdk, calls } = fakeSdk();
  const ads = createAdService({ sdk });
  await ads.init();
  assert.equal(await ads.showBanner('cg-banner-season'), true);
  ads.hideBanner('cg-banner-season');
  assert.deepEqual(calls.filter(c => c[0].toLowerCase().includes('banner')), [['banner', 'cg-banner-season'], ['clearBanner', 'cg-banner-season']]);

  sdk.banner.requestResponsiveBanner = async () => { throw { code: 'unfilled' }; };
  assert.equal(await ads.showBanner('cg-banner-season'), false);
  assert.equal(ads.adsDisabled, false);
});
