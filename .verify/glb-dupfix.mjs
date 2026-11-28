import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:600,height:600}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage();
await page.goto('http://127.0.0.1:5173/glbtest.html?m=101003.glb',{waitUntil:'networkidle2',timeout:30000});
await sleep(2600);
const info=await page.evaluate(()=>{
  const out=[];
  // walk the whole scene from the renderer's known object: use window hack - traverse document? instead: find via THREE cache not possible; use the fact glbtest added scene to window? no. quick: re-parse from DOM not possible. fallback: instrument via __scene if exists
  return window.__meshes || 'no-hook';
});
console.log('hook:',JSON.stringify(info));
await browser.close();
