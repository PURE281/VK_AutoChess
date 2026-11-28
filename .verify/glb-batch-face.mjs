import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:420,height:420}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ids=['101001','101002','101004','101012','101020','101038','201001','301020'];
for(const mid of ids){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=${mid}.glb&z=head`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2600);
  await page.screenshot({path:`.verify/bf-${mid}.png`});
  await page.close();
  console.log(mid);
}
await browser.close();
