import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:768,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');await sleep(500);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.scrollIntoView({block:'center'}));await sleep(100);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await sleep(250);
const bench=await page.evaluate(()=>({bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length,gold:window.__VALKYRIE_STATE__?.players[0].gold}));
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.scrollIntoView({block:'center'}));await sleep(100);
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await sleep(120);
const pos=await page.evaluate(()=>{const r=document.querySelector('.board-canvas-wrap').getBoundingClientRect();return {x:r.left+r.width*.5,y:r.top+r.height*.78,rect:{x:r.x,y:r.y,w:r.width,h:r.height}}});
await page.mouse.click(pos.x,pos.y);await sleep(400);
const deployed=await page.evaluate(()=>({board:Object.keys(window.__VALKYRIE_STATE__?.players[0].board||{}).length,phase:window.__VALKYRIE_STATE__?.phase}));
await page.evaluate(()=>document.querySelector('.shop-actions')?.scrollIntoView({block:'center'}));await sleep(100);
const start=await page.evaluate(()=>{const b=[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('开始战斗'));const r=b.getBoundingClientRect();return {disabled:b.disabled,x:r.left+r.width/2,y:r.top+r.height/2}});
if(!start.disabled){await page.mouse.click(start.x,start.y);await sleep(500)}
const after=await page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,combat:Boolean(window.__VALKYRIE_STATE__?.combat)}));
await page.screenshot({path:'.verify/tablet-start.png'});
console.log(JSON.stringify({bench,pos,deployed,start,after,errors},null,2));await browser.close();
