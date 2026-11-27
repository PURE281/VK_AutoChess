import puppeteer from 'puppeteer-core';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const url = 'http://127.0.0.1:5173/';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const consoleMessages = [];
page.on('console', (msg) => {
  if (['error', 'warning'].includes(msg.type())) consoleMessages.push(`${msg.type()}: ${msg.text()}`);
});
page.on('pageerror', (err) => consoleMessages.push(`pageerror: ${err.message}`));
await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 });
await page.waitForSelector('.shop-card:not(.empty)', { timeout: 10000 });
await page.screenshot({ path: '.verify/01-initial.png' });

const initial = await page.evaluate(() => ({
  round: document.querySelector('.round-card strong')?.textContent,
  gold: document.querySelector('.resource.gold strong')?.textContent,
  benchFilled: document.querySelectorAll('.bench-slot.filled').length,
  shopCards: document.querySelectorAll('.shop-card:not(.empty)').length,
  boardText: document.body.innerText.match(/上阵\s+(\d+)\/(\d+)/)?.[0] ?? '',
}));

// Buy the first available unit.
await page.click('.shop-card:not(.empty)');
await new Promise((r) => setTimeout(r, 350));
const afterBuy = await page.evaluate(() => ({
  gold: document.querySelector('.resource.gold strong')?.textContent,
  benchFilled: document.querySelectorAll('.bench-slot.filled').length,
}));
await page.screenshot({ path: '.verify/02-after-buy.png' });

// Select the first bench unit, then click the center of board-local tile (3,0).
const canvasBox = await page.evaluate(() => {
  const rect = document.querySelector('.board-canvas').getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
});
await page.click('.bench-slot.filled');
await new Promise((r) => setTimeout(r, 180));
function boardPoint(x, localY, width, height) {
  const scale = Math.max(0.66, Math.min(width / 690, height / 470));
  const tileW = 82 * scale;
  const tileH = 41 * scale;
  const cx = width / 2;
  const cy = 62 * scale;
  const wx = x;
  const wy = localY + 4;
  return {
    x: cx + ((wx - wy) * tileW) / 2,
    y: cy + ((wx + wy) * tileH) / 2,
  };
}
const pt = boardPoint(3, 0, canvasBox.width, canvasBox.height);
await page.mouse.click(canvasBox.left + pt.x, canvasBox.top + pt.y);
await new Promise((r) => setTimeout(r, 350));
const afterDeploy = await page.evaluate(() => ({
  boardText: document.body.innerText.match(/我方布阵区 · 上阵\s+(\d+)\/(\d+)/)?.[0] ?? '',
  selected: document.querySelectorAll('.bench-slot.selected').length,
}));
await page.screenshot({ path: '.verify/03-deployed.png' });

// Speed up and start combat.
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.speed-control button')];
  buttons.find((b) => b.textContent === '3x')?.click();
});
await page.click('.start-combat');
await new Promise((r) => setTimeout(r, 1800));
const duringCombat = await page.evaluate(() => ({
  hud: document.querySelector('.combat-hud')?.innerText ?? '',
  round: document.querySelector('.round-card strong')?.textContent,
}));
await page.screenshot({ path: '.verify/04-combat.png' });

let finalRound = null;
for (let i = 0; i < 70; i++) {
  await new Promise((r) => setTimeout(r, 500));
  finalRound = await page.evaluate(() => document.querySelector('.round-card strong')?.textContent);
  const modal = await page.evaluate(() => document.querySelector('.choice-modal')?.innerText ?? '');
  if (finalRound !== '1' || modal) break;
}
await new Promise((r) => setTimeout(r, 600));
const finalState = await page.evaluate(() => ({
  round: document.querySelector('.round-card strong')?.textContent,
  hp: document.querySelector('.resource.hp strong')?.textContent,
  gold: document.querySelector('.resource.gold strong')?.textContent,
  modal: document.querySelector('.choice-modal')?.innerText ?? '',
  log: document.querySelector('.log-lines')?.innerText ?? '',
}));
await page.screenshot({ path: '.verify/05-after-combat.png' });

console.log(JSON.stringify({ initial, afterBuy, afterDeploy, duringCombat, finalState, consoleMessages }, null, 2));
await browser.close();
