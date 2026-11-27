import puppeteer from 'puppeteer-core';
import * as THREE from 'three';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1500, height: 950 },
});
const errors = [];
function watch(page, tag) {
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`${tag} console: ${msg.text()}`); });
  page.on('pageerror', (err) => errors.push(`${tag} pageerror: ${err.message}`));
}
async function clickText(page, selector, text) {
  const ok = await page.evaluate((sel, wanted) => {
    const el = [...document.querySelectorAll(sel)].find((node) => node.textContent?.includes(wanted));
    if (!el) return false;
    el.click();
    return true;
  }, selector, text);
  if (!ok) throw new Error(`missing clickable ${selector}: ${text}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function openOnline(name) {
  const page = await browser.newPage();
  watch(page, name);
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForSelector('.mode-card.pvp', { timeout: 10000 });
  await page.click('.mode-card.pvp');
  await page.waitForSelector('.online-card label input', { timeout: 8000 });
  await page.click('.online-card label input');
  await page.type('.online-card label input', name);
  return page;
}
async function state(page) {
  return page.evaluate(() => window.__VALKYRIE_STATE__ ? {
    phase: window.__VALKYRIE_STATE__.phase,
    mode: window.__VALKYRIE_STATE__.mode,
    round: window.__VALKYRIE_STATE__.round,
    players: window.__VALKYRIE_STATE__.players.length,
    board: Object.keys(window.__VALKYRIE_STATE__.players[0].board).length,
    bench: window.__VALKYRIE_STATE__.players[0].bench.filter(Boolean).length,
    combat: window.__VALKYRIE_STATE__.combat ? {
      winner: window.__VALKYRIE_STATE__.combat.result.winner,
      frames: window.__VALKYRIE_STATE__.combat.result.frames.length,
      opponentName: window.__VALKYRIE_STATE__.combat.opponentName,
    } : null,
  } : null);
}
async function deployFirst(page) {
  await page.waitForSelector('.shop-card:not(.empty)', { timeout: 10000 });
  console.log('substep click shop');
  await page.evaluate(() => document.querySelector('.shop-card:not(.empty)')?.click());
  console.log('substep clicked shop');
  await page.waitForSelector('.bench-slot.filled', { timeout: 3000 });
  console.log('substep bench filled');
  await page.evaluate(() => document.querySelector('.bench-slot.filled')?.click());
  console.log('substep bench clicked');
  await sleep(180);
  const rect = await page.evaluate(() => {
    const r = document.querySelector('.board-canvas')?.getBoundingClientRect();
    return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
  });
  const camera = new THREE.PerspectiveCamera(42, rect.width / rect.height, 0.1, 100);
  camera.position.set(7.6, 8.7, 9.5);
  camera.lookAt(3.5, 0, 3.45);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  const p = new THREE.Vector3(3, 0, 4).project(camera);
  const cx = rect.left + ((p.x + 1) / 2) * rect.width;
  const cy = rect.top + ((1 - p.y) / 2) * rect.height;
  await page.evaluate((x, y) => {
    document.querySelector('.board-canvas')?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: x, clientY: y }));
  }, cx, cy);
  await sleep(450);
}

console.log('stage open a');
const a = await openOnline('Alpha');
console.log('stage create click');
await clickText(a, 'button', '创建房间');
await a.waitForSelector('.room-code', { timeout: 8000 });
console.log('stage room waiting');
const roomCode = await a.$eval('.room-code', (el) => el.textContent.trim());
console.log('room', roomCode);
await a.screenshot({ path: '.verify/pvp-lobby-room.png' });

console.log('stage open b');
const b = await openOnline('Beta');
await b.click('.join-row input');
await b.type('.join-row input', roomCode);
console.log('stage join click');
await clickText(b, 'button', '加入房间');
console.log('stage wait b shop');
await b.waitForSelector('.shop-card:not(.empty)', { timeout: 10000 });
console.log('stage b shop ready');
await a.waitForSelector('.shop-card:not(.empty)', { timeout: 10000 });
await sleep(800);
const initialA = await state(a);
const initialB = await state(b);
await a.screenshot({ path: '.verify/pvp-a-planning.png' });
await b.screenshot({ path: '.verify/pvp-b-planning.png' });

console.log('stage deploy a');
await deployFirst(a);
console.log('stage deploy a done');
console.log('stage deploy b');
await deployFirst(b);
console.log('stage deploy b done');
const deployedA = await state(a);
const deployedB = await state(b);
await clickText(a, 'button', '开始战斗');
await clickText(b, 'button', '开始战斗');
await sleep(1600);
const combatA = await state(a);
const combatB = await state(b);
await a.screenshot({ path: '.verify/pvp-a-combat.png' });
await b.screenshot({ path: '.verify/pvp-b-combat.png' });

console.log(JSON.stringify({ roomCode, initialA, initialB, deployedA, deployedB, combatA, combatB, errors: errors.slice(0, 20) }, null, 2));
await browser.close();
