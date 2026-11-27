import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:768,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.board-canvas-wrap');
const h1=await page.evaluate(()=>document.querySelector('.board-canvas-wrap').getBoundingClientRect().height);
await sleep(2500);
const h2=await page.evaluate(()=>document.querySelector('.board-canvas-wrap').getBoundingClientRect().height);
// Long press shop card: popup should appear, but no purchase should happen.
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.scrollIntoView({block:'center'}));await sleep(100);
const before=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length}));
const pos=await page.evaluate(()=>{const r=document.querySelector('.shop-card:not(.empty)').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
await page.mouse.move(pos.x,pos.y);await page.mouse.down();await sleep(700);await page.mouse.up();await sleep(250);
const afterLong=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length,popup:Boolean(document.querySelector('.champion-info-modal')),title:document.querySelector('.champion-info-modal h3')?.textContent}));
await page.screenshot({path:'.verify/longpress-popup.png'});
// Close and verify ordinary click still buys.
await page.click('.champion-info-close').catch(()=>{});await sleep(100);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await sleep(200);
const afterBuy=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length}));
console.log(JSON.stringify({h1,h2,growth:h2-h1,before,afterLong,afterBuy,errors},null,2));await browser.close();
