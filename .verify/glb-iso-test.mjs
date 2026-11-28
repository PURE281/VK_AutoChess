import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:620,height:620}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
for(const iso of['face','body']){
  const page=await browser.newPage();
  await page.goto(`http://127.0.0.1:5173/glbtest.html?m=101003.glb&z=head&iso=${iso}`,{waitUntil:'networkidle2',timeout:30000});
  await sleep(3000);
  await page.screenshot({path:`.verify/iso-${iso}.png`});
  await page.close();
}
console.log('done');
await browser.close();
