import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function openMobile(){
  const page=await browser.newPage();
  await page.setViewport({width:844,height:390,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
  await sleep(1800);
  await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
  await page.waitForSelector('.mode-card',{timeout:15000});
  return page;
}
const a=await openMobile();
// enter online screen
await a.evaluate(()=>{document.querySelectorAll('.mode-card')[1]?.click()});
await sleep(1200);
await a.screenshot({path:'.verify/online-mobile-01-entry.png'});
// measure overflow
const overflow=await a.evaluate(()=>({scrollW:document.documentElement.scrollWidth,innerW:window.innerWidth,cardW:document.querySelector('.online-card')?.getBoundingClientRect().width}));
// create room
await a.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('创建房间'));b?.click()});
await sleep(2000);
const roomState=await a.evaluate(()=>({code:document.querySelector('.room-code')?.textContent??null,waiting:Boolean(document.querySelector('.online-card.waiting'))}));
await a.screenshot({path:'.verify/online-mobile-02-waiting.png'});
// second client joins to start the match
const b=await openMobile();
await b.evaluate(()=>{document.querySelectorAll('.mode-card')[1]?.click()});
await sleep(1000);
if(roomState.code){
  await b.evaluate((code)=>{const input=document.querySelector('.join-row input');input.value=code;input.dispatchEvent(new Event('input',{bubbles:true}))},roomState.code);
  // react controlled input workaround: set via native setter
  await b.evaluate((code)=>{
    const input=document.querySelector('.join-row input');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(input,code);input.dispatchEvent(new Event('input',{bubbles:true}));
  },roomState.code);
  await sleep(300);
  await b.evaluate(()=>{const btn=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('加入房间'));btn?.click()});
}
await sleep(3000);
const inGame=await a.evaluate(()=>Boolean(document.querySelector('.battle-shell')));
await a.screenshot({path:'.verify/online-mobile-03-game.png'});
console.log(JSON.stringify({overflow,roomState,inGame}));
await browser.close();
