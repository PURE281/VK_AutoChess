import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:600,height:600}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const h of['2']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=101003.glb&hide=${h}`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2600);
  const mc=await page.evaluate(()=>window.__meshcount);
  await page.screenshot({path:`.verify/hide-${h}.png`});
  console.log('hide',h,'meshcount',mc);
  await page.close();
}
await browser.close();
