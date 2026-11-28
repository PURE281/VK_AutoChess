import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:420,height:420}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const mesh of['body_1','body_2','body_3']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=101003.glb&z=full&iso=only:${mesh}`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(2600);
  await page.screenshot({path:`.verify/pm-${mesh}.png`});
  await page.close();
  console.log(mesh);
}
await browser.close();
