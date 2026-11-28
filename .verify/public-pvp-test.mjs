import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900},protocolTimeout:240000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function openClient(name){
  const page=await browser.newPage();
  page.on('pageerror',e=>console.log(name,'pageerror:',e.message.slice(0,80)));
  await page.goto('https://pure281.github.io/VK_AutoChess/',{waitUntil:'networkidle2',timeout:60000});
  await sleep(2500);
  await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
  await page.waitForSelector('.mode-card',{timeout:20000});
  await page.evaluate(()=>{document.querySelectorAll('.mode-card')[1]?.click()});
  await sleep(1500);
  return page;
}
const a=await openClient('A');
const b=await openClient('B');
// wait for ws connection indicator on A
await sleep(2500);
const connA=await a.evaluate(()=>document.querySelector('.online-hint')?.textContent??'');
// A creates room
await a.evaluate(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.includes('创建房间'))?.click()});
await sleep(2500);
const code=await a.evaluate(()=>document.querySelector('.room-code')?.textContent?.trim()??null);
// B joins
if(code){
  await b.evaluate((c)=>{
    const input=document.querySelector('.join-row input');
    const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(input,c);input.dispatchEvent(new Event('input',{bubbles:true}));
  },code);
  await sleep(400);
  await b.evaluate(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.includes('加入房间'))?.click()});
}
await sleep(5000);
const stateA=await a.evaluate(()=>({battle:Boolean(document.querySelector('.battle-shell')),shop:document.querySelectorAll('.shop-card:not(.empty)').length}));
const stateB=await b.evaluate(()=>({battle:Boolean(document.querySelector('.battle-shell')),shop:document.querySelectorAll('.shop-card:not(.empty)').length}));
await a.screenshot({path:'.verify/public-pvp-a.png'}).catch(()=>{});
console.log(JSON.stringify({connA:connA.slice(0,80),code,stateA,stateB}));
await browser.close();
