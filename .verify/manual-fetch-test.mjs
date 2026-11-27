import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage();await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');await new Promise(r=>setTimeout(r,6000));
const r=await page.evaluate(async()=>{
 const t=Date.now();try{const res=await fetch('/assets/scenes/stg1100.glb');const ab=await res.arrayBuffer();return {ok:true,len:ab.byteLength,ms:Date.now()-t}}catch(e){return {ok:false,error:String(e),ms:Date.now()-t}}
});
console.log(JSON.stringify({manual:r,state:await page.evaluate(()=>window.__vcStageState)}));await browser.close();
