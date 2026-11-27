import puppeteer from 'puppeteer-core';
import * as THREE from 'three';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (['error'].includes(msg.type())) errors.push(`${msg.type()}: ${msg.text()}`); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
await page.waitForSelector('.mode-card.pve', { timeout: 12000 });
await new Promise((r) => setTimeout(r, 800));
const lobby = await page.evaluate(() => ({
  title: document.querySelector('.lobby-header h1')?.textContent,
  modes: [...document.querySelectorAll('.mode-card')].map((el) => el.querySelector('strong')?.textContent),
  showcase: document.querySelectorAll('.showcase-card img').length,
  features: document.querySelectorAll('.lobby-feature-strip > div').length,
}));
await page.screenshot({ path: '.verify/lobby-01.png' });

await page.click('.codex-entry');
await page.waitForSelector('.codex-card', { timeout: 8000 });
await new Promise((r) => setTimeout(r, 700));
const codex = await page.evaluate(() => ({
  cards: document.querySelectorAll('.codex-card').length,
  selected: document.querySelector('.codex-title-block h2')?.textContent,
  skill: document.querySelector('.skill-section strong')?.textContent,
  detailVisible: Boolean(document.querySelector('.codex-portrait-frame img')?.complete),
}));
await page.screenshot({ path: '.verify/codex-01.png', fullPage: false });
await page.select('.codex-filters select:nth-of-type(4)', '5');
await new Promise((r) => setTimeout(r, 250));
const costFive = await page.evaluate(() => document.querySelectorAll('.codex-card').length);
await page.click('.codex-header .ghost-button');
await page.waitForSelector('.mode-card.pve', { timeout: 8000 });

await page.click('.mode-card.pve');
await page.waitForSelector('.shop-card:not(.empty)', { timeout: 12000 });
await new Promise((r) => setTimeout(r, 1200));
const pveInitial = await page.evaluate(() => {
  const state = window.__VALKYRIE_STATE__;
  return {
    mode: state?.mode,
    players: state?.players.length,
    phase: state?.phase,
    roundType: state?.roundType,
    topbar: document.querySelector('.brand span')?.textContent,
    shop: document.querySelectorAll('.shop-card:not(.empty)').length,
  };
});
await page.screenshot({ path: '.verify/pve-planning.png' });

// Buy and deploy one unit, then enter combat through the real UI path.
const boardRect = await page.evaluate(() => {
  const r = document.querySelector('.board-canvas')?.getBoundingClientRect();
  return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
});
await page.click('.shop-card:not(.empty)');
await new Promise((r) => setTimeout(r, 300));
await page.click('.bench-slot.filled');
await new Promise((r) => setTimeout(r, 150));
const camera = new THREE.PerspectiveCamera(42, boardRect.width / boardRect.height, 0.1, 100);
camera.position.set(7.6, 8.7, 9.5);
camera.lookAt(3.5, 0, 3.45);
camera.updateMatrixWorld();
camera.updateProjectionMatrix();
const projected = new THREE.Vector3(3, 0, 4).project(camera);
await page.mouse.click(
  boardRect.left + ((projected.x + 1) / 2) * boardRect.width,
  boardRect.top + ((1 - projected.y) / 2) * boardRect.height,
);
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => { [...document.querySelectorAll('.speed-control button')].find((b) => b.textContent === '3x')?.click(); });
await page.click('.start-combat');
await new Promise((r) => setTimeout(r, 1000));
const pveCombat = await page.evaluate(() => {
  const state = window.__VALKYRIE_STATE__;
  return {
    phase: state?.phase,
    roundType: state?.combat?.roundType,
    opponent: state?.combat?.opponentName,
    frames: state?.combat?.result.frames.length,
    events: state?.combat?.result.events.length,
  };
});
await page.screenshot({ path: '.verify/pve-combat.png' });

const audio = await page.evaluate(async () => {
  const keys = ['bgm_home', 'battle_start', 'attack', 'skill', 'win'];
  const result = {};
  for (const key of keys) {
    const a = new Audio(`/assets/audio/${key}.mp3`);
    a.volume = 0;
    try {
      await a.play();
      a.pause();
      result[key] = { ok: true, duration: Number.isFinite(a.duration) ? a.duration : null };
    } catch (err) {
      result[key] = { ok: false, error: String(err) };
    }
  }
  return result;
});

await page.evaluate(() => { [...document.querySelectorAll('.top-actions > button')].find((b) => b.textContent === '回大厅')?.click(); });
await page.waitForSelector('.mode-card.pvp', { timeout: 8000 });
await page.click('.mode-card.pvp');
await page.waitForSelector('.shop-card:not(.empty)', { timeout: 12000 });
const pvpInitial = await page.evaluate(() => {
  const state = window.__VALKYRIE_STATE__;
  return { mode: state?.mode, players: state?.players.length, phase: state?.phase, topbar: document.querySelector('.brand span')?.textContent };
});
await page.screenshot({ path: '.verify/pvp-planning.png' });

console.log(JSON.stringify({ lobby, codex, costFive, pveInitial, pveCombat, audio, pvpInitial, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
