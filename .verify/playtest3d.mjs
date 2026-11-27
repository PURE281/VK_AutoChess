import puppeteer from 'puppeteer-core';
import * as THREE from 'three';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox', '--use-angle=swiftshader'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const consoleMessages = [];
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('.shop-card:not(.empty)', { timeout: 10000 });
await new Promise((r) => setTimeout(r, 1500));
await page.screenshot({ path: '.verify/3d-01-initial.png' });

const initial = await page.evaluate(() => ({
  caption: document.querySelector('.board-3d-caption')?.textContent ?? '',
  shopCards: document.querySelectorAll('.shop-card:not(.empty)').length,
  canvas: (() => { const r=document.querySelector('.board-canvas')?.getBoundingClientRect(); return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null })(),
}));

// Buy first unit and deploy to board-local (3,0), world tile z=4.
await page.click('.shop-card:not(.empty)');
await new Promise((r) => setTimeout(r, 500));
await page.click('.bench-slot.filled');
await new Promise((r) => setTimeout(r, 250));
const rect = initial.canvas;
const camera = new THREE.PerspectiveCamera(42, rect.width / rect.height, 0.1, 100);
camera.position.set(7.6, 8.7, 9.5);
camera.lookAt(3.5, 0, 3.45);
camera.updateMatrixWorld();
camera.updateProjectionMatrix();
const p = new THREE.Vector3(3, 0, 4).project(camera);
const sx = rect.left + ((p.x + 1) / 2) * rect.width;
const sy = rect.top + ((1 - p.y) / 2) * rect.height;
await page.mouse.click(sx, sy);
await new Promise((r) => setTimeout(r, 1000));
const afterDeploy = await page.evaluate(() => ({
  caption: document.querySelector('.board-3d-caption')?.textContent ?? '',
  selected: document.querySelectorAll('.bench-slot.selected').length,
}));
await page.screenshot({ path: '.verify/3d-02-deployed.png' });

// Start combat at 3x, inspect canvas rendering and capture mid-combat.
await page.evaluate(() => {
  [...document.querySelectorAll('.speed-control button')].find((b) => b.textContent === '3x')?.click();
});
await page.click('.start-combat');
await new Promise((r) => setTimeout(r, 2200));
const duringCombat = await page.evaluate(() => ({
  hud: document.querySelector('.combat-hud')?.innerText ?? '',
  pixels: (() => {
    const c = document.querySelector('.board-canvas');
    if (!c) return null;
    const off = document.createElement('canvas');
    off.width = 32; off.height = 20;
    const ctx = off.getContext('2d');
    try { ctx.drawImage(c, 0, 0, 32, 20); return Array.from(ctx.getImageData(16,10,1,1).data); } catch(e) { return String(e); }
  })(),
}));
await page.screenshot({ path: '.verify/3d-03-combat.png' });

await new Promise((r) => setTimeout(r, 3500));
await page.screenshot({ path: '.verify/3d-04-latecombat.png' });
console.log(JSON.stringify({ initial, afterDeploy, duringCombat, consoleMessages: consoleMessages.slice(0,30) }, null, 2));
await browser.close();
