import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
// landscape phone (typical gaming orientation)
await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
await sleep(2200);
await page.screenshot({path:'.verify/mobile-01-notice.png'});
await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
await page.waitForSelector('.mode-card.pve',{timeout:15000}).catch(()=>{});
await sleep(800);
await page.screenshot({path:'.verify/mobile-02-lobby.png'});
await page.evaluate(()=>document.querySelector('.mode-card.pve')?.click());
await sleep(2500);
await page.screenshot({path:'.verify/mobile-03-game.png'});
console.log('done');
await browser.close();
