import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1400,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');
await new Promise(r=>setTimeout(r,6000));
await page.evaluate(()=>{const el=document.querySelector(".board-3d-wrap");if(el)el.style.background="none";});
await page.mouse.move(700,420);await page.mouse.down();await page.mouse.move(1020,390,{steps:20});await page.mouse.up();await new Promise(r=>setTimeout(r,500));
await page.screenshot({path:'.verify/stage-longwait.png'});
console.log(JSON.stringify({errors},null,2));await browser.close();
