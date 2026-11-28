import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1400,height:900}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage();
page.on('console',m=>{if(m.type()==='error')console.log('ERR',m.text().slice(0,120))});
page.on('pageerror',e=>console.log('PAGEERR',String(e).slice(0,200)));
await page.goto('http://127.0.0.1:5173/skin-admin.html',{waitUntil:'networkidle2',timeout:30000});
await sleep(1500);
await page.screenshot({path:'.verify/admin-login.png'});
// enter password (any - health check failure still enters)
await page.type('#pwInput','test');
await page.click('#pwBtn');
await sleep(2500);
const visible=await page.evaluate(()=>getComputedStyle(document.getElementById('app')).display);
console.log('app display:',visible);
await page.screenshot({path:'.verify/admin-app.png'});
// try loading a unit
await sleep(2000);
await page.evaluate(()=>{
  const sel=document.getElementById('unitSelect');
  if(sel&&sel.options.length){sel.value='101003';}
  document.getElementById('loadModel')?.click();
});
await sleep(6000);
await page.screenshot({path:'.verify/admin-loaded.png'});
const status=await page.evaluate(()=>document.getElementById('status').textContent);
console.log('status:',status);
await browser.close();
