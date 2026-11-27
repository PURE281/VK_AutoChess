import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser=await puppeteer.launch({executablePath:chrome,headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1500,height:950}});
const errors=[];function watch(p,tag){p.on('pageerror',e=>errors.push(tag+':'+e.message));p.on('console',m=>{if(m.type()==='error')errors.push(tag+':'+m.text())})}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function clickText(page,selector,text){const ok=await page.evaluate((sel,w)=>{const el=[...document.querySelectorAll(sel)].find(x=>x.textContent?.includes(w));if(!el)return false;el.click();return true},selector,text);if(!ok)throw new Error('missing '+text)}
async function openOnline(name){const p=await browser.newPage();watch(p,name);await p.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await p.waitForSelector('.mode-card.pvp');await p.click('.mode-card.pvp');await p.waitForSelector('.online-card label input');await p.click('.online-card label input');await p.type('.online-card label input',name);return p}
async function deployFirst(page){await page.bringToFront();await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());await page.waitForSelector('.bench-slot.filled',{timeout:3000});await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());await sleep(180);const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null});const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,.1,100);camera.position.set(3.5+12.25*Math.sin(.785)*Math.sin(.595),12.25*Math.cos(.785),3.45+12.25*Math.sin(.785)*Math.cos(.595));camera.lookAt(3.5,0,3.45);camera.updateMatrixWorld();camera.updateProjectionMatrix();const p=new THREE.Vector3(3,0,6).project(camera);const cx=rect.left+((p.x+1)/2)*rect.width;const cy=rect.top+((1-p.y)/2)*rect.height;await page.evaluate((x,y)=>document.querySelector('.board-canvas')?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y})),cx,cy);await sleep(350)}
async function playback(page){return page.evaluate(()=>window.__board3dDebug?.playback ?? -1)}
async function phase(page){return page.evaluate(()=>({phase:window.__VALKYRIE_STATE__?.phase,pending:window.__VALKYRIE_STATE__?.pendingItem,inventory:window.__VALKYRIE_STATE__?.players[0].itemInventory.length,modal:Boolean(document.querySelector('.modal-backdrop .item-card, .modal-backdrop [class*=item]')||document.querySelector('.modal-backdrop'))}))}
const a=await openOnline('Alpha');await clickText(a,'button','创建房间');await a.waitForSelector('.room-code');const code=await a.$eval('.room-code',el=>el.textContent.trim());
const b=await openOnline('Beta');await b.click('.join-row input');await b.type('.join-row input',code);await clickText(b,'button','加入房间');await b.waitForSelector('.shop-card:not(.empty)');await a.waitForSelector('.shop-card:not(.empty)');
await deployFirst(a);await deployFirst(b);
const debugDeploy=await Promise.all([a,b].map(async p=>p.evaluate(()=>({board:Object.keys(window.__VALKYRIE_STATE__?.players[0].board??{}).length,bench:window.__VALKYRIE_STATE__?.players[0].bench.filter(Boolean).length,gold:window.__VALKYRIE_STATE__?.players[0].gold,rect:(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?{x:r.x,y:r.y,w:r.width,h:r.height}:null})(),hit:(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?document.elementFromPoint(r.left+r.width/2,r.top+r.height*.74)?.tagName:null})()}))));
console.log('debugDeploy',JSON.stringify(debugDeploy));
await a.screenshot({path:'.verify/debug-deploy-a.png'});await b.screenshot({path:'.verify/debug-deploy-b.png'});
await clickText(a,'button','开始战斗');await clickText(b,'button','开始战斗');
await a.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='combat',{timeout:6000});await b.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='combat',{timeout:6000});
await sleep(500);const samples=[];for(let i=0;i<14;i++){samples.push(await playback(a));if(i===5)await clickText(a,'button','跳过演出');await sleep(150)}
const decreases=[];for(let i=1;i<samples.length;i++)if(samples[i]<samples[i-1]-.025)decreases.push({i,from:samples[i-1],to:samples[i]});
// Finish the skip vote, then both clients must receive a real item modal.
await clickText(b,'button','跳过演出');await sleep(700);
await a.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='item'&&window.__VALKYRIE_STATE__?.pendingItem,{timeout:5000});
await b.waitForFunction(()=>window.__VALKYRIE_STATE__?.phase==='item'&&window.__VALKYRIE_STATE__?.pendingItem,{timeout:5000});
await sleep(250);const itemA=await phase(a),itemB=await phase(b);
const modalHits=await Promise.all([a,b].map(p=>p.evaluate(()=>{const cards=[...document.querySelectorAll('button')].filter(x=>x.offsetParent&&x.textContent?.match(/生命|攻击|复制|神器|符文|装备|恢复|金币/));return {buttons:cards.slice(0,8).map(x=>x.textContent.trim().slice(0,70)),count:cards.length}})));
// Choose the first artifact card in each modal.
for(const p of [a,b]) await p.evaluate(()=>{const modal=[...document.querySelectorAll('.modal-backdrop')].pop();const btn=modal?.querySelector('button');btn?.click()});await sleep(550);
const afterA=await phase(a),afterB=await phase(b);
console.log(JSON.stringify({code,samples:samples.map(x=>Number(x.toFixed(3))),decreases,itemA,itemB,modalHits,afterA,afterB,errors},null,2));await browser.close();
