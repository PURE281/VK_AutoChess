import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
await sleep(2000);
await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
await page.waitForSelector('.mode-card.pve',{timeout:15000});
await page.click('.mode-card.pve');
await page.waitForSelector('.board-canvas',{timeout:15000});
await sleep(1800);
// buy first shop card, then close the shop drawer via tab and check the board is fully visible
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());
await sleep(500);
const benchFilled=await page.evaluate(()=>Boolean(document.querySelector('.bench-slot.filled')));
await page.evaluate(()=>document.querySelector('.drawer-tab-bottom')?.click());
await sleep(700);
await page.screenshot({path:'.verify/mobile-04-board-only.png'});
// board metrics: visible size vs viewport
const metrics=await page.evaluate(()=>{
  const r=document.querySelector('.board-canvas')?.getBoundingClientRect();
  return r?{w:Math.round(r.width),h:Math.round(r.height)}:null;
});
console.log(JSON.stringify({benchFilled,boardMetrics:metrics}));
await browser.close();
