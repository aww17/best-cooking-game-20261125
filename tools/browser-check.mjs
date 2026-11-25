import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE,
  headless: true,
  args: ['--no-sandbox'],
});
const errors = [];
const requests = new Set();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on('pageerror', (error) => errors.push(error.message));
page.on('requestfailed', (request) => errors.push(request.url() + ': ' + request.failure()?.errorText));
page.on('request', (request) => {
  requests.add(request.url());
  if (!request.url().startsWith('http://localhost:8080/')) errors.push('Unexpected request: ' + request.url());
});
page.on('response', (response) => {
  if (response.status() !== 200) errors.push('HTTP ' + response.status() + ': ' + response.url());
});

async function state() {
  return page.evaluate(() => window.__game.state);
}

async function clickControl(kind, id = null) {
  const point = await page.evaluate(({ kind, id }) => {
    const layout = window.__game.renderer.getLayout();
    const rect = kind === 'bin' ? layout.bins.find((bin) => bin.id === id).rect
      : kind === 'grill' ? layout.grill[id] : layout[kind];
    const canvas = document.getElementById('game').getBoundingClientRect();
    return {
      x: canvas.left + (rect.x + (rect.w || 0) / 2) * canvas.width / 1280,
      y: canvas.top + (rect.y + (rect.h || 0) / 2) * canvas.height / 720,
    };
  }, { kind, id });
  await page.mouse.click(point.x, point.y);
}

async function playTest() {
  await page.goto('http://localhost:8080/?seed=1');
  await page.waitForFunction(() => window.__game?.state.screen === 'title');
  await page.mouse.click(640, 500);
  assert.equal((await state()).screen, 'play');
  assert.equal((await state()).orders.length, 2);
  assert.ok((await state()).orders.some((order) => order.recipe.id === 'classic'));
  for (const id of ['bun', 'lettuce', 'tomato', 'patty']) await clickControl('bin', id);
  assert.deepEqual((await state()).plate, ['bun', 'lettuce', 'tomato']);
  assert.equal((await state()).grill[0].phase, 'raw');
  await clickControl('grill', 0);
  assert.equal((await state()).plate.length, 3, 'A raw patty cannot be plated');
  await page.waitForFunction(() => window.__game.state.grill[0].phase === 'cooked', null, { timeout: 8000 });
  await clickControl('grill', 0);
  assert.equal((await state()).grill[0].phase, 'empty');
  assert.equal((await state()).plate.length, 4);
  await clickControl('bell');
  const served = await state();
  assert.ok(served.score > 0);
  assert.equal(served.served, 1);
  assert.equal(served.combo, 1);
  assert.equal(served.lives, 3);
  assert.equal(served.plate.length, 0);
  console.log(JSON.stringify({ check: 'click through a Classic Burger', score: served.score, lives: served.lives }));

  await page.waitForFunction(() => window.__game.state.lives === 2, null, { timeout: 45000 });
  const expired = await state();
  assert.ok(expired.orders.some((order) => order.state === 'fail'));
  assert.equal(expired.combo, 0);
  assert.equal(expired.screen, 'play');
  await clickControl('bin', 'bun');
  await clickControl('bell');
  const wrong = await state();
  assert.equal(wrong.lives, 1);
  assert.equal(wrong.plate.length, 0);
  assert.equal(wrong.score, served.score);
  await clickControl('bin', 'bun');
  await clickControl('bell');
  assert.equal((await state()).screen, 'over');
  assert.equal((await state()).lives, 0);
  await page.keyboard.press('r');
  const restarted = await state();
  assert.equal(restarted.screen, 'play');
  assert.equal(restarted.lives, 3);
  assert.equal(restarted.score, 0);
  assert.equal(restarted.served, 0);
  assert.equal(restarted.orders.filter((order) => order.state === 'open').length, 2);
  console.log(JSON.stringify({ check: 'expiry, wrong serve, game over, R restart', expiryTick: expired.tick, wrongLives: wrong.lives, restarted: true }));
}

async function extraControls() {
  await page.goto('http://localhost:8080/?seed=1');
  await page.waitForFunction(() => window.__game);
  await page.mouse.click(640, 500);
  await page.keyboard.press('p');
  const pausedTick = (await state()).tick;
  await page.waitForTimeout(800);
  assert.equal((await state()).screen, 'paused');
  assert.equal((await state()).tick, pausedTick);
  await clickControl('resumeButton');
  assert.equal((await state()).screen, 'play');
  await page.keyboard.press('m');
  assert.equal((await state()).muted, true);
  await page.keyboard.press('m');
  assert.equal((await state()).muted, false);
  for (const key of ['1', '3', '4', '5', '6', '1']) await page.keyboard.press(key);
  assert.equal((await state()).plate.length, 5);
  await clickControl('trashBin');
  assert.equal((await state()).plate.length, 0);
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('2');
  assert.equal((await state()).grill.filter((slot) => slot.phase === 'raw').length, 2);
  await page.waitForFunction(() => window.__game.state.grill.every((slot) => slot.phase === 'cooked'), null, { timeout: 8000 });
  await page.keyboard.press('g');
  assert.deepEqual((await state()).plate, ['patty']);
  await page.keyboard.press('t');
  await page.waitForFunction(() => window.__game.state.grill[1].phase === 'burned', null, { timeout: 10000 });
  await clickControl('grill', 1);
  assert.equal((await state()).grill[1].phase, 'empty');
  assert.equal((await state()).lives, 3);
  await page.setViewportSize({ width: 960, height: 540 });
  await page.waitForFunction(() => document.getElementById('game').getBoundingClientRect().width === 960);
  await clickControl('bin', 'tomato');
  assert.deepEqual((await state()).plate, ['tomato']);
  await page.keyboard.press('r');
  assert.equal((await state()).screen, 'play');
  assert.equal((await state()).plate.length, 0);
  console.log(JSON.stringify({ check: 'pause, resume, mute, capacity, grill limit, G, T, burning, discard, resize, live restart', ok: true }));
}

async function captureShots() {
  for (const [index, name] of ['cover', 'play', 'serve', 'end'].entries()) {
    await page.goto('http://localhost:8080/?shot=' + name + '&seed=1');
    await page.waitForFunction(() => window.__shotReady);
    await page.waitForTimeout(1500);
    const frozen = await state();
    const checks = await page.evaluate((name) => {
      const { state: s } = window.__game;
      const open = s.orders.filter((order) => order.state === 'open');
      const match = open.some((order) => {
        const need = { ...order.recipe.requires };
        for (const id of s.plate) need[id] = (need[id] || 0) - 1;
        return Object.values(need).every((count) => count === 0);
      });
      if (name === 'cover') return [s.screen === 'play', s.tick === 1080, open.length === 2,
        s.plate.join(',') === 'bun,lettuce,tomato', s.grill[0].phase === 'raw', Math.abs(s.grill[0].progress - 0.5) < 0.01];
      if (name === 'play') return [s.screen === 'play', open.length === 3, open.some((order) => order.left < 15),
        s.plate.length === 2, s.grill.some((slot) => slot.phase === 'raw')];
      if (name === 'serve') return [s.screen === 'play', open[0].recipe.id === 'classic', s.plate.length === 4, match];
      return [s.screen === 'over', s.lives === 0, s.served === 5, s.score > 0, s.bestCombo === 5];
    }, name);
    assert.ok(checks.every(Boolean), name + ': incorrect staged state');
    const path = new URL('../screenshots/' + (index + 1) + '-' + name + '.jpg', import.meta.url);
    const bytes = await page.screenshot({ path: path.pathname, type: 'jpeg', quality: 85 });
    assert.equal(statSync(path).size, bytes.length);
    assert.ok(bytes.length > 10000 && bytes.length <= 262144);
    const dimensions = await page.evaluate(async (encoded) => {
      const image = new Image();
      image.src = 'data:image/jpeg;base64,' + encoded;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, readFileSync(path).toString('base64'));
    assert.deepEqual(dimensions, [1280, 720]);
    await page.waitForTimeout(100);
    assert.deepEqual(await state(), frozen, 'Shot simulation must stay frozen');
    const repeat = await page.screenshot({ type: 'jpeg', quality: 85 });
    assert.ok(bytes.equals(repeat), 'Shot pixels must stay frozen');
    console.log(JSON.stringify({ file: path.pathname, bytes: bytes.length, dimensions, score: frozen.score,
      served: frozen.served, tick: frozen.tick, sha256: createHash('sha256').update(bytes).digest('hex') }));
  }
}

try {
  const mode = process.argv[2] || 'play';
  if (mode === 'shots') await captureShots();
  else if (mode === 'extra') await extraControls();
  else await playTest();
  assert.deepEqual(errors, [], 'Browser errors or unexpected network activity');
  console.log(JSON.stringify({ mode, ok: true, loadedRequests: requests.size, errors }));
} finally {
  await browser.close();
}
