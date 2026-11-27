import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox'],defaultViewport:{width:1000,height:700}});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function clickText(p,s,t){await p.evaluate((s,t)=>[...document.querySelectorAll(s)].find(x=>x.textContent?.includes(t))?.click(),s,t)}
async function open(name){const p=await browser.newPage();p.on('pageerror',e=>console.log('err',e.message));await p.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await p.click('.mode-card.pvp');await p.waitForSelector('.online-card label input');await p.click('.online-card label input');await p.type('.online-card label input',name);return p}
const a=await open('Alpha');await clickText(a,'button','创建房间');await a.waitForSelector('.room-code');const code=await a.$eval('.room-code',x=>x.textContent.trim());const b=await open('Beta');await b.click('.join-row input');await b.type('.join-row input',code);await clickText(b,'button','加入房间');await sleep(2500);
for(const [n,p] of [['a',a],['b',b]]) console.log(n,await p.evaluate(()=>({hook:typeof window.__VALKYRIE_PVP_SEND__,state:window.__VALKYRIE_STATE__?.phase,mode:window.__VALKYRIE_STATE__?.mode,shop:document.querySelectorAll('.shop-card').length})).catch(e=>e.message));
await browser.close();
