import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:420,height:420}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const pov of[2,8,30]){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=101003.glb&z=head&po=${pov}`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2600);
  await page.screenshot({path:`.verify/potune-${pov}.png`});
  await page.close();
  console.log('po',pov);
}
await browser.close();
