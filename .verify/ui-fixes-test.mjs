import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1500,height:950}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('.mode-card.chaos',{timeout:12000});
const modeCards=await page.$$eval('.mode-card',x=>x.length);
await page.screenshot({path:'.verify/fix-lobby.png'});
// Codex count
await page.click('.codex-entry');await page.waitForSelector('.codex-card',{timeout:10000});await sleep(900);
const codexCount=await page.$eval('.codex-count strong',x=>x.textContent);
await page.screenshot({path:'.verify/fix-codex-full.png'});
await page.click('.codex-header .ghost-button');
// Start PVE and deploy first unit
await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});await sleep(800);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());
await page.waitForSelector('.bench-slot.filled',{timeout:4000});
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());
// Click center of player half approximately; use direct mouse because this is deployment validation.
await page.mouse.click(690,510);await sleep(500);
const st=await page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,board:Object.keys(window.__VALKYRIE_STATE__?.players[0].board||{}).length,mode:window.__VALKYRIE_STATE__?.mode,rangeSample:window.__VALKYRIE_STATE__?.activeRoster.slice(0,20).length}));
await page.screenshot({path:'.verify/fix-board-arena.png'});
// Drag camera then screenshot.
await page.mouse.move(700,430);await page.mouse.down();await page.mouse.move(940,500,{steps:8});await page.mouse.up();await sleep(500);
await page.screenshot({path:'.verify/fix-board-rotated.png'});
console.log(JSON.stringify({modeCards,codexCount,st,errors:errors.slice(0,10)},null,2));
await browser.close();
