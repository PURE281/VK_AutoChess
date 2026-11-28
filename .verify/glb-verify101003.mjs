import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:600,height:600}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage();
await page.goto('http://127.0.0.1:5173/glbtest.html?m=101003.glb',{waitUntil:'networkidle2',timeout:30000});
await sleep(2600);
await page.screenshot({path:'.verify/fixed-101003.png'});
console.log('done');
await browser.close();
