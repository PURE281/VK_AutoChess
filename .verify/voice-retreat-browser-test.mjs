import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1400,height:900}});
const page=await browser.newPage();const errors=[];
await page.evaluateOnNewDocument(()=>{window.__playedAudio=[];const p=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__playedAudio.push(this.currentSrc||this.src);return p.call(this).catch(()=>undefined)}});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');await sleep(600);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await page.waitForSelector('.bench-slot.filled');await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await page.mouse.click(690,510);await sleep(400);
// Select the deployed unit on the board and send it back to the first empty bench slot.
await page.mouse.click(690,510);await sleep(180);
await page.evaluate(()=>document.querySelector('.bench-slot:not(.filled)')?.click());await sleep(800);
const result=await page.evaluate(()=>({played:window.__playedAudio,board:Object.keys(window.__VALKYRIE_STATE__?.players[0].board||{}).length,bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length}));
console.log(JSON.stringify({result,errors},null,2));await browser.close();
