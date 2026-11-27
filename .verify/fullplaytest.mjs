import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
  defaultViewport: { width: 1600, height: 1000 },
});
const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle0', timeout: 20000 });
await page.waitForFunction(() => window.__VALKYRIE_STATE__?.phase === 'planning', { timeout: 10000 });
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('.speed-control button')];
  buttons.find((b) => b.textContent === '3x')?.click();
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const state = () => page.evaluate(() => window.__VALKYRIE_STATE__);
async function clickShopSlot(slot) {
  await page.evaluate((slot) => {
    const cards = [...document.querySelectorAll('.shop-cards .shop-card')];
    cards[slot]?.click();
  }, slot);
  await sleep(90);
}
async function clickBench(index) {
  await page.evaluate((index) => {
    const slots = [...document.querySelectorAll('.bench-grid .bench-slot')];
    slots[index]?.click();
  }, index);
  await sleep(80);
}
async function boardScreenPoint(x, localY) {
  const box = await page.evaluate(() => {
    const rect = document.querySelector('.board-canvas').getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  });
  const scale = Math.max(0.66, Math.min(box.width / 690, box.height / 470));
  const tileW = 82 * scale;
  const tileH = 41 * scale;
  const cx = box.width / 2;
  const cy = 62 * scale;
  const wy = localY + 4;
  return {
    x: box.left + cx + ((x - wy) * tileW) / 2,
    y: box.top + cy + ((x + wy) * tileH) / 2,
  };
}
async function deployAll() {
  for (let guard = 0; guard < 24; guard++) {
    const st = await state();
    if (st.phase !== 'planning') return;
    const me = st.players[0];
    const limit = me.level + (me.augments.includes('extra_deploy') ? 1 : 0);
    const boardCount = Object.keys(me.board).length;
    if (boardCount >= limit) return;
    const benchIndex = me.bench.findIndex(Boolean);
    if (benchIndex < 0) return;
    let empty = null;
    for (let y = 0; y < 4 && !empty; y++) {
      for (let x = 0; x < 8 && !empty; x++) {
        if (!me.board[`${x},${y}`]) empty = { x, y };
      }
    }
    if (!empty) return;
    await clickBench(benchIndex);
    const pt = await boardScreenPoint(empty.x, empty.y);
    await page.mouse.click(pt.x, pt.y);
    await sleep(100);
  }
}
async function chooseModalIfNeeded() {
  const st = await state();
  if (st.phase === 'augment' || st.phase === 'item') {
    await page.evaluate(() => document.querySelector('.choice-card')?.click());
    await sleep(150);
    return true;
  }
  return false;
}
async function buyUnits() {
  for (let guard = 0; guard < 12; guard++) {
    const st = await state();
    if (st.phase !== 'planning') return;
    const me = st.players[0];
    const reserve = st.round <= 2 ? 0 : st.round <= 6 ? 3 : 8;
    const slot = me.shop.findIndex((s) => s.championId && !s.sold && (st.activeRoster.includes(s.championId)));
    if (slot < 0) return;
    const cid = me.shop[slot].championId;
    const cost = await page.evaluate((cid) => window.__VALKYRIE_STATE__ && window.__VALKYRIE_DATA_COSTS?.[cid], cid);
    // Costs are mirrored in the shop button state; infer from affordability by trying when gold is at least 1.
    if (me.gold - reserve < 1) return;
    const beforeGold = me.gold;
    const beforeBench = me.bench.filter(Boolean).length + Object.keys(me.board).length;
    await clickShopSlot(slot);
    const after = await state();
    const afterMe = after.players[0];
    const afterUnits = afterMe.bench.filter(Boolean).length + Object.keys(afterMe.board).length;
    if (afterMe.gold === beforeGold && afterUnits === beforeBench) return;
  }
}
async function maybeLevel() {
  const st = await state();
  const me = st.players[0];
  if (st.phase === 'planning' && me.level < 9 && me.gold >= (st.round < 4 ? 12 : 18)) {
    await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('.shop-actions button')];
      buttons.find((b) => b.innerText.includes('研习'))?.click();
    });
    await sleep(90);
  }
}

const timeline = [];
for (let roundGuard = 0; roundGuard < 42; roundGuard++) {
  await chooseModalIfNeeded();
  let st = await state();
  if (st.phase === 'gameover') break;
  if (st.phase !== 'planning') {
    await page.evaluate(() => document.querySelector('.combat-hud button')?.click());
    await sleep(180);
    continue;
  }

  await buyUnits();
  await deployAll();
  await buyUnits();
  await deployAll();
  await maybeLevel();
  st = await state();
  const me = st.players[0];
  timeline.push({
    round: st.round,
    type: st.roundType,
    hp: me.hp,
    gold: me.gold,
    level: me.level,
    board: Object.keys(me.board).length,
    bench: me.bench.filter(Boolean).length,
    augments: me.augments.length,
    items: me.itemInventory.length,
    aliveBots: st.players.filter((p) => !p.isHuman && p.alive).length,
  });

  await page.evaluate(() => document.querySelector('.start-combat')?.click());
  await sleep(220);
  const combatState = await state();
  if (combatState.phase === 'combat') {
    if (st.round === 5 || st.round === 9 || st.round === 13) {
      await sleep(900);
      await page.screenshot({ path: `.verify/combat-round-${st.round}.png` });
    }
    await page.evaluate(() => document.querySelector('.combat-hud button')?.click());
    await sleep(260);
  }
  await chooseModalIfNeeded();
}

const final = await state();
await page.screenshot({ path: '.verify/fullplaytest-final.png' });
const summary = {
  timeline,
  final: {
    phase: final.phase,
    round: final.round,
    result: final.gameResult,
    hp: final.players[0].hp,
    gold: final.players[0].gold,
    level: final.players[0].level,
    board: Object.keys(final.players[0].board).length,
    augments: final.players[0].augments,
    items: final.players[0].itemInventory,
    alive: final.players.map((p) => ({ id: p.id, human: p.isHuman, hp: p.hp, alive: p.alive, level: p.level })),
    log: final.log.slice(0, 14),
  },
  errors,
};
console.log(JSON.stringify(summary, null, 2));
await browser.close();
