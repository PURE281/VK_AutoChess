import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('.mode-card.pve',{timeout:10000});
await sleep(1400);
const initial=await page.evaluate(async()=>({
 resources:performance.getEntriesByType('resource').map(x=>x.name),
 swControlled:Boolean(navigator.serviceWorker?.controller),
 swRegs:(await navigator.serviceWorker?.getRegistrations?.()??[]).length
}));
const initialBoardChunk=initial.resources.filter(x=>x.includes('BoardCanvas3D')).length;
await page.click('.mode-card.pve');
await page.waitForSelector('.shop-card:not(.empty)',{timeout:12000});
await page.waitForSelector('.board-canvas',{timeout:12000});
await sleep(1800);
const after=await page.evaluate(async()=>({
 boardResources:performance.getEntriesByType('resource').filter(x=>x.name.includes('BoardCanvas3D')).length,
 swControlled:Boolean(navigator.serviceWorker?.controller),
 swRegs:(await navigator.serviceWorker?.getRegistrations?.()??[]).length,
 cacheNames:await caches.keys(),
 canvas:Boolean(document.querySelector('.board-canvas')),
 shop:document.querySelectorAll('.shop-card:not(.empty)').length,
 phase:window.__VALKYRIE_STATE__?.phase
}));
if(!after.canvas||!after.boardResources) throw new Error('lazy board chunk did not load in production');
if(!after.swRegs) throw new Error('service worker was not registered');
console.log(JSON.stringify({initialBoardChunk,...after,initialSw:initial,errors:errors.slice(0,8)},null,2));
await browser.close();
