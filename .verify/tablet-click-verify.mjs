import puppeteer from 'puppeteer-core';
for(const width of [1000,820,768]){
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width,height:900}});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-actions button');
 await page.evaluate(()=>document.querySelector('.shop-actions')?.scrollIntoView({block:'center'}));
 await new Promise(r=>setTimeout(r,150));
 const hit=await page.evaluate(()=>[...document.querySelectorAll('.shop-actions button')].map((b,i)=>{const r=b.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {i,text:b.textContent.slice(0,4),disabled:b.disabled,inside:b.contains(el),hit:el?el.tagName+'.'+el.className:null,x:r.x,y:r.y,w:r.width}}));
 const before=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,locked:window.__VALKYRIE_STATE__?.players[0].shopLocked,shop:window.__VALKYRIE_STATE__?.players[0].shop.map(x=>x.championId)}));
 const pos=await page.evaluate(()=>{const b=[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('刷新'));const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 await page.mouse.click(pos.x,pos.y);await new Promise(r=>setTimeout(r,250));
 const pos2=await page.evaluate(()=>{const b=[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('锁定'));const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}});
 await page.mouse.click(pos2.x,pos2.y);await new Promise(r=>setTimeout(r,250));
 const after=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,locked:window.__VALKYRIE_STATE__?.players[0].shopLocked,shop:window.__VALKYRIE_STATE__?.players[0].shop.map(x=>x.championId)}));
 console.log(JSON.stringify({width,hit,before,after,rerolled:before.gold-after.gold===2,locked:after.locked===true,errors},null,2));
 await browser.close();
}
