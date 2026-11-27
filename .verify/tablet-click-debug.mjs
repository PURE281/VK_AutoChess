import puppeteer from 'puppeteer-core';
for(const width of [1000,820,768]){
 const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width,height:900}});
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-actions button');
 const info=await page.evaluate(()=>{
  const buttons=[...document.querySelectorAll('.shop-actions button')].map((b,i)=>{
   const r=b.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {i,text:b.textContent,disabled:b.disabled,rect:{x:r.x,y:r.y,w:r.width,h:r.height},hit:el?(`${el.tagName}.${el.className}`):null,inside:b.contains(el)};
  });
  const shop=document.querySelector('.shop-panel')?.getBoundingClientRect();
  const bottom=document.querySelector('.bottom-row')?.getBoundingClientRect();
  const canvas=document.querySelector('.board-canvas-wrap')?.getBoundingClientRect();
  const right=document.querySelector('.right-sidebar')?.getBoundingClientRect();
  return {width:innerWidth,scrollY:scrollY,buttons,shop:shop?.toJSON(),bottom:bottom?.toJSON(),canvas:canvas?.toJSON(),right:right?.toJSON(),bodyH:document.body.scrollHeight};
 });
 // Actually click reroll after collapsing panels.
 await page.evaluate(()=>{document.querySelectorAll('.right-sidebar .panel-title-row').forEach(x=>x.dispatchEvent(new MouseEvent('click',{bubbles:true})))});
 const before=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,shop:window.__VALKYRIE_STATE__?.players[0].shop.map(x=>x.championId)}));
 await page.evaluate(()=>{[...document.querySelectorAll('.shop-actions button')].find(x=>x.textContent.includes('刷新'))?.click()});
 await new Promise(r=>setTimeout(r,300));
 const after=await page.evaluate(()=>({gold:window.__VALKYRIE_STATE__?.players[0].gold,shop:window.__VALKYRIE_STATE__?.players[0].shop.map(x=>x.championId)}));
 console.log(JSON.stringify({width,info,before,after,changed:JSON.stringify(before.shop)!==JSON.stringify(after.shop),errors},null,2));
 await browser.close();
}
