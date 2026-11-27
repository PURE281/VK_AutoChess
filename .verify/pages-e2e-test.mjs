import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,120))});page.on('pageerror',e=>errors.push(e.message.slice(0,120)));
const failed=[];page.on('requestfailed',r=>failed.push(r.url().slice(0,110)));
await page.goto('https://pure281.github.io/VK_AutoChess/',{waitUntil:'networkidle2',timeout:45000});
const lobby=await page.evaluate(()=>({
 modeCards:document.querySelectorAll('.mode-card').length,
 lobbyVisible:Boolean(document.querySelector('.mode-card.pve')),
 swRegs:0
}));
await new Promise(r=>setTimeout(r,2000));
lobby.swRegs=await page.evaluate(async()=>(await navigator.serviceWorker?.getRegistrations?.()??[]).length).catch(()=>0);
// try entering pve: check how far it gets (board will fail on CORS but shop UI should render)
await page.click('.mode-card.pve').catch(()=>undefined);
await new Promise(r=>setTimeout(r,6000));
const game=await page.evaluate(()=>({
 shopCards:document.querySelectorAll('.shop-card:not(.empty)').length,
 canvas:Boolean(document.querySelector('.board-canvas')),
 boardLoading:document.querySelector('.board-loading')?.textContent??''
}));
await page.screenshot({path:'.verify/pages-e2e.png'});
console.log(JSON.stringify({lobby,game,failedCount:failed.length,failedSample:failed.slice(0,4),errors:errors.slice(0,5)},null,2));
await browser.close();
