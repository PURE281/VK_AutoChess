import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1280,height:850}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.battle-shell');await sleep(500);
const planning=await page.evaluate(()=>({shell:Boolean(document.querySelector('.battle-shell')),top:document.querySelector('.top-drawer')?.className,bottom:document.querySelector('.bottom-drawer')?.className,left:document.querySelector('.left-drawer')?.className,right:document.querySelector('.right-drawer')?.className,board:document.querySelector('.board-canvas-wrap')?.getBoundingClientRect().toJSON(),tabs:[...document.querySelectorAll('.drawer-tab')].map(x=>x.textContent)}));
// Buy/deploy then start combat through real UI.
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await sleep(200);
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await sleep(100);
const boardPos=await page.evaluate(()=>{const r=document.querySelector('.board-canvas-wrap').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.75}});
await page.mouse.click(boardPos.x,boardPos.y);await sleep(250);
const deployed=await page.evaluate(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board||{}).length);
await page.evaluate(()=>[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('开始战斗'))?.click());await sleep(700);
const combat=await page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,topVisible:getComputedStyle(document.querySelector('.top-drawer')).visibility,bottomVisible:getComputedStyle(document.querySelector('.bottom-drawer')).visibility,leftVisible:getComputedStyle(document.querySelector('.left-drawer')).visibility,rightVisible:getComputedStyle(document.querySelector('.right-drawer')).visibility,stats:Boolean(document.querySelector('.combat-stats-float')),statsVisible:document.querySelector('.combat-stats-float')?getComputedStyle(document.querySelector('.combat-stats-float')).visibility:null,board:document.querySelector('.board-canvas-wrap')?.getBoundingClientRect().toJSON()}));
await page.screenshot({path:'.verify/immersive-combat.png'});
// Restore drawers manually in combat.
await page.click('.drawer-tab-right');await sleep(250);
const rightOpen=await page.evaluate(()=>getComputedStyle(document.querySelector('.right-drawer')).visibility);
await page.click('.drawer-tab-bottom');await sleep(250);
const bottomOpen=await page.evaluate(()=>getComputedStyle(document.querySelector('.bottom-drawer')).visibility);
await page.click('.drawer-tab-left');await sleep(250);
const leftOpen=await page.evaluate(()=>getComputedStyle(document.querySelector('.left-drawer')).visibility);
await page.screenshot({path:'.verify/immersive-drawers-open.png'});
console.log(JSON.stringify({planning,deployed,combat,restore:{rightOpen,bottomOpen,leftOpen},errors},null,2));await browser.close();
