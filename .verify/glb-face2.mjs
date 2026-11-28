import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:620,height:620}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const mid of['101003','301038']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=${mid}.glb&z=head`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(3500);
  const info=await page.evaluate(()=>window.__meshInfo);
  console.log(mid,JSON.stringify(info));
  await page.screenshot({path:`.verify/face2-${mid}.png`});
  await page.close();
}
await browser.close();
