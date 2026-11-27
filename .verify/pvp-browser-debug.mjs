import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', headless:true, args:['--disable-gpu','--no-sandbox','--use-angle=swiftshader'], defaultViewport:{width:1200,height:800}});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
async function clickText(page, selector, text){ await page.evaluate((sel,w)=>[...document.querySelectorAll(sel)].find(n=>n.textContent?.includes(w))?.click(),selector,text); }
async function openOnline(name){
 const page=await browser.newPage(); page.on('console',m=>console.log(name,'console',m.type(),m.text().slice(0,180))); page.on('pageerror',e=>console.log(name,'pageerror',e.message));
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.mode-card.pvp'); await page.click('.mode-card.pvp'); await page.waitForSelector('.online-card label input'); await page.type('.online-card label input',name); return page;
}
const a=await openOnline('A'); await clickText(a,'button','创建房间'); await a.waitForSelector('.room-code'); const code=await a.$eval('.room-code',e=>e.textContent.trim()); console.log('code',code);
const b=await openOnline('B'); await b.type('.join-row input',code); await clickText(b,'button','加入房间'); await b.waitForSelector('.shop-card:not(.empty)'); console.log('b shop');
for (const [tag,p] of [['a',a],['b',b]]) {
 for (let i=0;i<5;i++) {
  const result=await Promise.race([p.evaluate(()=>({ok:1,shop:document.querySelectorAll('.shop-card:not(.empty)').length,bench:document.querySelectorAll('.bench-slot.filled').length,ready:document.readyState})).then(x=>['ok',x]),sleep(2000).then(()=>['timeout'])]);
  console.log(tag,i,result);
  await sleep(500);
 }
}
await browser.close();
