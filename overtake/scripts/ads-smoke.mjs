// CrazyGames ad integration smoke test. The real CDN is blocked and a mock SDK
// records lifecycle calls, so this verifies placement rules without serving ads.
import { chromium as pw } from '@playwright/test';
import chromium from '@sparticuz/chromium';
import assert from 'node:assert/strict';

const launch = async () => pw.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: chromium.args.filter(a => a !== '--single-process').concat(['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox']),
  env: { ...process.env, LD_LIBRARY_PATH: `/home/user/.local/lib/chromium-deps:${process.env.LD_LIBRARY_PATH || ''}` },
});

const browser = await launch();
const base = process.env.BASE_URL || 'http://localhost:4191';
const mock = (adblocked = false) => {
  window.__cgCalls = [];
  window.__cgSettings = null;
  window.CrazyGames = { SDK: {
    environment: 'crazygames',
    init: async () => { window.__cgCalls.push('init'); },
    game: {
      settings: { muteAudio: false },
      gameplayStart: () => window.__cgCalls.push('gameplayStart'),
      gameplayStop: () => window.__cgCalls.push('gameplayStop'),
      happytime: () => window.__cgCalls.push('happytime'),
      addSettingsChangeListener: fn => { window.__cgSettings = fn; },
    },
    ad: {
      hasAdblock: async () => adblocked,
      requestAd: (kind, cb) => {
        window.__cgCalls.push(`ad:${kind}`);
        window.__cgAdKind = kind;
        setTimeout(() => cb.adStarted(), 120);
        setTimeout(() => cb.adFinished(), 800);
      },
    },
    banner: {
      requestResponsiveBanner: async id => { window.__cgCalls.push(`banner:${id}`); },
      clearBanner: id => { window.__cgCalls.push(`clearBanner:${id}`); },
    },
  } };
};

async function newPage(viewport, adblocked = false) {
  const page = await browser.newPage({ viewport });
  page.setDefaultTimeout(180000);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.route('https://sdk.crazygames.com/**', route => route.abort());
  await page.addInitScript(mock, adblocked);
  await page.addInitScript(() => localStorage.setItem('overtake-progression-v2', JSON.stringify({ version: 2, walletVersion: 1, coins: 0, credits: 0, gems: 0, dev: false, owned: ['golf', 'challenger', 'skyline', 'mustang', 'bmw-m3'], upgrades: {}, tunes: {}, seasonPass: null })));
  await page.goto(`${base}/play.html?test=1`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('#topbar:not(.hidden)', { timeout: 180000 });
  await page.evaluate(() => cancelAnimationFrame(window.__overtake.raf));
  return { page, errors };
}

async function finishRun(page) {
  await page.evaluate(() => {
    const g = window.__overtake;
    g.setRunMode('endless'); g.setSelectedCar('golf');
    if (!g.start()) throw new Error('run did not start');
    g.run.score = 1200; g.run.distance = 600;
    g.endRun('crash');
  });
  await page.waitForSelector('#gameover:not(.hidden)', { timeout: 30000 });
}

try {
  // 1. Happy path: lifecycle, layout, rewarded double, mute, banner.
  const { page, errors } = await newPage({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  assert.deepEqual(await page.evaluate(() => window.__cgCalls.slice(0, 1)), ['init'], 'SDK initializes once');
  assert.equal(await page.evaluate(() => document.body.classList.contains('crazygames')), true);

  await finishRun(page);
  await page.waitForTimeout(250);
  const callsAfterRun = await page.evaluate(() => [...window.__cgCalls]);
  assert.ok(callsAfterRun.includes('gameplayStart'), 'gameplayStart fires when driving');
  assert.ok(callsAfterRun.includes('gameplayStop'), 'gameplayStop fires on results');
  assert.equal(await page.evaluate(() => document.getElementById('btn-ad-double').classList.contains('hidden')), false);
  const earned = await page.evaluate(() => ({
    text: document.getElementById('final-progress-text').textContent,
    coins: window.__overtake.getProgression().coins,
  }));
  assert.match(earned.text, /earned/);
  assert.ok(earned.coins > 0);
  await page.screenshot({ path: 'test-results/ads-results-desktop.png', fullPage: true });

  // The offer must fit the results card at phone and landscape sizes too.
  for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const modal = document.querySelector('#gameover .modal').getBoundingClientRect();
      const offer = document.getElementById('btn-ad-double').getBoundingClientRect();
      const progress = document.getElementById('final-progress').getBoundingClientRect();
      return { modal: { top: modal.top, bottom: modal.bottom, height: modal.height }, offer: { top: offer.top, bottom: offer.bottom }, progress: { top: progress.top, bottom: progress.bottom }, viewport: { w: innerWidth, h: innerHeight }, visible: !document.getElementById('btn-ad-double').classList.contains('hidden') };
    });
    assert.equal(layout.visible, true, `${name}: offer visible`);
    assert.ok(layout.modal.top >= -1 && layout.modal.bottom <= layout.viewport.h + 1, `${name}: results modal fits (${JSON.stringify(layout)})`);
    assert.ok(layout.offer.top >= layout.modal.top && layout.offer.bottom <= layout.modal.bottom, `${name}: ad offer inside the modal`);
    await page.screenshot({ path: `test-results/ads-results-${name}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(250);

  await page.click('#btn-ad-double');
  await page.waitForSelector('#ad-curtain:not(.hidden)', { timeout: 5000 });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__audio.adMuted), true, 'audio is muted while the ad plays');
  assert.equal(await page.evaluate(() => window.__cgAdKind), 'rewarded');
  await page.waitForFunction(() => document.getElementById('ad-curtain').classList.contains('hidden'), { timeout: 10000 });
  assert.equal(await page.evaluate(() => window.__audio.adMuted), false, 'mute is restored after the ad');
  await page.waitForTimeout(150);
  const claimed = await page.evaluate(() => ({
    text: document.getElementById('final-progress').textContent,
    coins: window.__overtake.getProgression().coins,
    hidden: document.getElementById('btn-ad-double').classList.contains('hidden'),
    calls: [...window.__cgCalls],
  }));
  assert.match(claimed.text, /from ad/);
  assert.ok(claimed.coins >= earned.coins * 2 - 1, `wallet doubled: ${earned.coins} -> ${claimed.coins}`);
  assert.equal(claimed.hidden, true, 'the offer disappears after it is claimed once');
  assert.ok(claimed.calls.includes('happytime'));
  await page.screenshot({ path: 'test-results/ads-results-claimed.png', fullPage: true });

  // Season drawer: responsive banner + optional gem offer, then cooldown.
  await page.evaluate(() => { window.__overtake.toGarage(); });
  await page.waitForTimeout(200);
  await page.click('#open-season');
  await page.waitForSelector('#drawer-season:not(.hidden)', { timeout: 10000 });
  await page.waitForTimeout(700);
  const season = await page.evaluate(() => ({
    calls: [...window.__cgCalls],
    banner: !document.getElementById('cg-banner-season').classList.contains('hidden'),
    gems: !document.getElementById('btn-ad-gems').classList.contains('hidden'),
  }));
  assert.ok(season.calls.includes('banner:cg-banner-season'), 'responsive banner is requested');
  assert.equal(season.banner, true);
  assert.equal(season.gems, true);
  await page.screenshot({ path: 'test-results/ads-season-desktop.png', fullPage: false });
  const gemsBefore = await page.evaluate(() => window.__overtake.getProgression().gems);
  await page.click('#btn-ad-gems');
  await page.waitForTimeout(1200);
  const gemsAfter = await page.evaluate(() => window.__overtake.getProgression().gems);
  assert.ok(gemsAfter >= gemsBefore + 3, `gems granted: ${gemsBefore} -> ${gemsAfter}`);
  assert.equal(await page.evaluate(() => document.getElementById('btn-ad-gems').classList.contains('hidden')), true, 'gem offer respects its cooldown');
  assert.ok((await page.evaluate(() => window.__cgCalls)).filter(c => c === 'ad:rewarded').length >= 2);

  // Closing the drawer clears the banner through the SDK.
  await page.click('#drawer-close');
  await page.waitForTimeout(250);
  assert.ok((await page.evaluate(() => window.__cgCalls)).includes('clearBanner:cg-banner-season'));

  // A midgame break only rides on "Drive again" after a couple of runs.
  await page.evaluate(() => {
    const g = window.__overtake;
    g.setRunMode('endless'); g.setSelectedCar('golf');
    if (!g.start()) throw new Error('second run did not start');
    g.run.score = 400; g.run.distance = 200;
    g.endRun('crash');
  });
  await page.waitForSelector('#gameover:not(.hidden)', { timeout: 30000 });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__ads.state.lastVideoAt = 0; });
  await page.click('#btn-retry');
  await page.waitForSelector('#ad-curtain:not(.hidden)', { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__cgAdKind), 'midgame');
  await page.waitForFunction(() => window.__overtake.mode === 'driving', { timeout: 10000 });
  assert.ok((await page.evaluate(() => window.__cgCalls)).filter(c => c === 'ad:midgame').length >= 1);
  assert.equal(await page.evaluate(() => document.getElementById('ad-curtain').classList.contains('hidden')), true, 'curtain clears before the next run');

  // 3. Adblock: everything stays playable and no ad buttons render.
  {
    const { page: p, errors: blockErrors } = await newPage({ width: 1024, height: 768 }, true);
    await p.waitForTimeout(400);
    await finishRun(p);
    await p.waitForTimeout(300);
    assert.equal(await p.evaluate(() => document.getElementById('btn-ad-double').classList.contains('hidden')), true, 'no rewarded offer with an adblocker');
    await p.evaluate(() => window.__overtake.toGarage());
    await p.waitForTimeout(200);
    await p.click('#open-season');
    await p.waitForTimeout(500);
    assert.equal(await p.evaluate(() => document.getElementById('btn-ad-gems').classList.contains('hidden')), true);
    assert.equal(await p.evaluate(() => document.getElementById('cg-banner-season').classList.contains('hidden')), true);
    assert.ok((await p.evaluate(() => window.__cgCalls)).includes('gameplayStop'), 'game still runs');
    assert.equal(blockErrors.length, 0, `adblock page errors: ${blockErrors.join(' | ')}`);
  }

  assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
  console.log('ads smoke: OK');
} finally {
  await browser.close();
}
