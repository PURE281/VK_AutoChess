import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:768,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');await sleep(800);
const height=async()=>page.evaluate(()=>document.querySelector('.board-canvas-wrap')?.getBoundingClientRect().height);
const initial=await height();
// Buy and deploy one unit.
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await sleep(200);
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.scrollIntoView({block:'center'}));await sleep(100);
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await sleep(100);
const boardPos=await page.evaluate(()=>{const r=document.querySelector('.board-canvas-wrap').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.78}});
await page.mouse.click(boardPos.x,boardPos.y);await sleep(350);
const deployed=await page.evaluate(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board||{}).length);
// Long press the deployed board unit at the same board position.
await page.mouse.move(boardPos.x,boardPos.y);await page.mouse.down();await sleep(720);await page.mouse.up();await sleep(250);
const boardPopup=await page.evaluate(()=>({popup:Boolean(document.querySelector('.champion-info-modal')),title:document.querySelector('.champion-info-modal h3')?.textContent,phase:window.__VALKYRIE_STATE__?.phase}));
await page.screenshot({path:'.verify/board-longpress-popup.png'});
await page.click('.champion-info-close').catch(()=>{});await sleep(120);
// Start battle and monitor container height while models load/combat plays.
await page.evaluate(()=>document.querySelector('.shop-actions')?.scrollIntoView({block:'center'}));await sleep(100);
await page.evaluate(()=>[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('开始战斗'))?.click());
await sleep(300);
const combatStart=await height();
const samples=[];for(let i=0;i<8;i++){await sleep(900);samples.push(await height())}
const state=await page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,combat:Boolean(window.__VALKYRIE_STATE__?.combat)}));
console.log(JSON.stringify({initial,deployed,boardPopup,combatStart,samples,growth:Math.max(...samples)-Math.min(...samples),state,errors},null,2));
await browser.close();
