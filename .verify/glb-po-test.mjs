import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:420,height:420}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const[mid,z]of[['101003','head'],['301038','head']]){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=${mid}.glb&z=${z}&po=1`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2800);
  await page.screenshot({path:`.verify/po-${mid}.png`});
  await page.close();
}
console.log('done');
await browser.close();
