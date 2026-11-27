import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1400, height: 900 } });
const page = await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
let found=null;
for(let attempt=0;attempt<25 && !found;attempt++){
 await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle0'});
 await page.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='planning');
 const st=await page.evaluate(()=>window.__VALKYRIE_STATE__);
 const seen=new Map();
 for(let i=0;i<st.players[0].shop.length;i++){
  const id=st.players[0].shop[i].championId;
  if(!id)continue;
  if(seen.has(id))found={id,slots:[seen.get(id),i],seed:st.seed};
  else seen.set(id,i);
 }
}
if(!found){
 console.log(JSON.stringify({ok:false,reason:'no duplicate shop pair in 25 seeds'},null,2));
 await browser.close();
 process.exit(0);
}
for(const slot of found.slots){
 await page.evaluate((slot)=>[...document.querySelectorAll('.shop-cards .shop-card')][slot]?.click(),slot);
 await new Promise(r=>setTimeout(r,180));
}
const st=await page.evaluate(()=>window.__VALKYRIE_STATE__);
const units=[...Object.values(st.players[0].board),...st.players[0].bench.filter(Boolean)].filter(u=>u.championId===found.id);
console.log(JSON.stringify({ok:units.some(u=>u.star===2),found,units,log:st.log.slice(0,8),errors},null,2));
await browser.close();
