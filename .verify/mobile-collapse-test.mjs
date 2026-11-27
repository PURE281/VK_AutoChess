import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1000,height:800}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.right-sidebar .panel-title-row');
const result=await page.evaluate(()=>{
 const panel=document.querySelector('.right-sidebar .panel');
 const title=panel?.querySelector('.panel-title-row');
 const content=panel?.querySelector('.panel-title-row + *');
 const before={class:panel?.className,display:content?getComputedStyle(content).display:null,height:panel?.getBoundingClientRect().height};
 title?.dispatchEvent(new MouseEvent('click',{bubbles:true}));
 const after={class:panel?.className,display:content?getComputedStyle(content).display:null,height:panel?.getBoundingClientRect().height};
 return {before,after};
});
await page.screenshot({path:'.verify/mobile-collapse.png'});
console.log(JSON.stringify({result,errors},null,2));await browser.close();
