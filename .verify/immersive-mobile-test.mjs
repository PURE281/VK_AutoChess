import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:768,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.battle-shell');await sleep(500);
const planning=await page.evaluate(()=>({board:document.querySelector('.board-canvas-wrap').getBoundingClientRect().toJSON(),bottomVisible:getComputedStyle(document.querySelector('.bottom-drawer')).visibility,topVisible:getComputedStyle(document.querySelector('.top-drawer')).visibility}));
// Verify shop buttons are clickable in the drawer.
await page.evaluate(()=>document.querySelector('.bottom-drawer')?.scrollIntoView({block:'end'}));await sleep(100);
const before=await page.evaluate(()=>window.__VALKYRIE_STATE__?.players[0].gold);
await page.evaluate(()=>[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('刷新'))?.click());await sleep(220);
const after=await page.evaluate(()=>window.__VALKYRIE_STATE__?.players[0].gold);
// Deploy and enter combat.
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await sleep(160);
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await sleep(100);
const pos=await page.evaluate(()=>{const r=document.querySelector('.board-canvas-wrap').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.74}});
await page.mouse.click(pos.x,pos.y);await sleep(250);
await page.evaluate(()=>[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('开始战斗'))?.click());await sleep(650);
const combat=await page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,board:document.querySelector('.board-canvas-wrap').getBoundingClientRect().toJSON(),topVisible:getComputedStyle(document.querySelector('.top-drawer')).visibility,bottomVisible:getComputedStyle(document.querySelector('.bottom-drawer')).visibility,stats:Boolean(document.querySelector('.combat-stats-float')),skipHit:(()=>{const b=[...document.querySelectorAll('.combat-hud button')].find(x=>x.textContent.includes('跳过'));if(!b)return null;const r=b.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return b.contains(el)})()}));
await page.screenshot({path:'.verify/immersive-mobile-combat.png'});
console.log(JSON.stringify({planning,reroll:{before,after,cost:before-after},combat,errors},null,2));await browser.close();
