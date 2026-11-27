import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120))});page.on('pageerror',e=>errors.push(e.message.slice(0,120)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
// 1. disclaimer should be visible on first visit
await sleep(2500);
const noticeVisible=await page.evaluate(()=>Boolean(document.querySelector('.fan-notice-card')));
await page.screenshot({path:'.verify/redesign-01-notice.png'});
// agree
if(noticeVisible)await page.click('.fan-notice-agree');
await sleep(600);
await page.waitForSelector('.mode-card.pve',{timeout:15000});
await page.screenshot({path:'.verify/redesign-02-lobby.png'});
// reload: notice should NOT reappear (localStorage)
await page.reload({waitUntil:'networkidle2'});
await sleep(2500);
const noticeAgain=await page.evaluate(()=>Boolean(document.querySelector('.fan-notice-card')));
// enter game for combat UI
await page.click('.mode-card.pve');
await page.waitForSelector('.board-canvas',{timeout:15000});
await sleep(2000);
await page.screenshot({path:'.verify/redesign-03-game.png'});
console.log(JSON.stringify({noticeVisible,noticeAgain,errors:errors.slice(0,5)}));
await browser.close();
