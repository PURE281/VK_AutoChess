import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:600,height:600}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const v of['2','10']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=103018.glb&d=2.2&fix=po&v=${v}`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2800);
  await page.screenshot({path:`.verify/po103018-${v}.png`});
  await page.close();
  console.log('v'+v);
}
await browser.close();
