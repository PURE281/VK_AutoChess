import puppeteer from 'puppeteer-core';
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1280,height:850}});
const errors=[];function watch(p,tag){p.on('pageerror',e=>errors.push(tag+':'+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(tag+':'+m.text())})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function clickText(page,selector,text){const ok=await page.evaluate((sel,w)=>{const el=[...document.querySelectorAll(sel)].find(x=>x.textContent?.includes(w));if(!el)return false;el.click();return true},selector,text);if(!ok)throw new Error('missing '+text)}
async function openOnline(name){const p=await browser.newPage();watch(p,name);await p.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await p.waitForSelector('.mode-card.pvp');await p.click('.mode-card.pvp');await p.waitForSelector('.online-card label input');await p.click('.online-card label input');await p.type('.online-card label input',name);return p}
async function send(page,message){await page.evaluate(m=>window.__VALKYRIE_PVP_SEND__?.(m),message)}
async function prepare(page){
 const label=await page.evaluate(()=>window.__VALKYRIE_STATE__?.players[0]?.name??'?');
 await page.waitForFunction(()=>window.__VALKYRIE_PVP_SEND__&&window.__VALKYRIE_STATE__?.phase==='planning',{timeout:8000});
 const slot=await page.evaluate(()=>window.__VALKYRIE_STATE__.players[0].shop.findIndex(x=>x.championId));
 await send(page,{type:'action',action:{type:'BUY_UNIT',slot}});
 await page.waitForFunction(()=>window.__VALKYRIE_STATE__?.players[0].bench.some(Boolean),{timeout:4000});
 const bench=await page.evaluate(()=>window.__VALKYRIE_STATE__.players[0].bench.findIndex(Boolean));
 await send(page,{type:'action',action:{type:'MOVE_UNIT',from:{type:'bench',index:bench},to:{type:'board',x:3,y:2}}});
 await sleep(500);
 await page.waitForFunction(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board??{}).length>0,{timeout:4000});
 await send(page,{type:'ready'});
 await sleep(350);
}
async function playback(page){return page.evaluate(()=>window.__board3dDebug?.playback ?? -1)}
async function phase(page){return page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,pending:Boolean(window.__VALKYRIE_STATE__?.pendingItem),inventory:window.__VALKYRIE_STATE__?.players[0].itemInventory.length,itemCards:document.querySelectorAll('.choice-card.item-choice').length,itemTiers:[...document.querySelectorAll('.choice-card.item-choice .item-tier')].map(x=>x.textContent),goldText:document.querySelector('.resource.gold small')?.textContent??'',modalText:document.querySelector('.choice-modal')?.textContent?.slice(0,80)??''}))}
const a=await openOnline('Alpha');await clickText(a,'button','创建房间');await a.waitForSelector('.room-code');const code=await a.$eval('.room-code',el=>el.textContent.trim());
const b=await openOnline('Beta');await b.click('.join-row input');await b.type('.join-row input',code);await clickText(b,'button','加入房间');await b.waitForSelector('.shop-card:not(.empty)',{timeout:8000});await a.waitForSelector('.shop-card:not(.empty)',{timeout:8000});
await prepare(a);await prepare(b);

await a.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='combat',{timeout:6000});await b.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='combat',{timeout:6000});
await a.bringToFront();await sleep(550);const samples=[];for(let i=0;i<14;i++){samples.push(await playback(a));if(i===3)await send(a,{type:'action',action:{type:'SET_COMBAT_SPEED',speed:2}});if(i===5)await send(a,{type:'skip'});await sleep(150)}
const decreases=[];for(let i=1;i<samples.length;i++)if(samples[i]<samples[i-1]-.025)decreases.push({i,from:samples[i-1],to:samples[i]});
await send(b,{type:'skip'});
await a.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='item'&&window.__VALKYRIE_STATE__?.pendingItem,{timeout:5000});
await b.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='item'&&window.__VALKYRIE_STATE__?.pendingItem,{timeout:5000});
await sleep(250);const itemA=await phase(a),itemB=await phase(b);
await a.screenshot({path:'.verify/pvp-item-modal-a.png'});await b.screenshot({path:'.verify/pvp-item-modal-b.png'});
for(const p of [a,b]) await p.evaluate(()=>document.querySelector('.choice-card.item-choice')?.click());
await a.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='planning'&&window.__VALKYRIE_STATE__?.players[0].itemInventory.length===1,{timeout:5000});
await b.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='planning'&&window.__VALKYRIE_STATE__?.players[0].itemInventory.length===1,{timeout:5000});
const afterA=await phase(a),afterB=await phase(b);
console.log(JSON.stringify({code,samples:samples.map(x=>Number(x.toFixed(3))),decreases,itemA,itemB,afterA,afterB,errors},null,2));await browser.close();
