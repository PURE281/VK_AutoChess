import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function testViewport(w,h,label){
  const page=await browser.newPage();
  await page.setViewport({width:w,height:h,isMobile:true,hasTouch:true,deviceScaleFactor:2});
  await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
  await sleep(1500);
  await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
  await page.waitForSelector('.mode-card',{timeout:15000});
  await page.evaluate(()=>{document.querySelectorAll('.mode-card')[1]?.click()});
  await sleep(1000);
  const metrics=await page.evaluate(()=>{
    const card=document.querySelector('.online-card')?.getBoundingClientRect();
    return{scrollW:document.documentElement.scrollWidth,innerW:window.innerWidth,cardRight:card?Math.round(card.right):0,cardVisible:card?card.width<=window.innerWidth+2:false};
  });
  await page.screenshot({path:`.verify/online-${label}.png`});
  console.log(label,JSON.stringify(metrics));
  await page.close();
}
await testViewport(844,390,'landscape');
await testViewport(390,844,'portrait');
await browser.close();
