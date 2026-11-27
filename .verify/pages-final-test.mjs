import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,140))});page.on('pageerror',e=>errors.push(e.message.slice(0,140)));
const glbRequests=[];const failed=[];
page.on('request',r=>{if(r.url().includes('.glb'))glbRequests.push(r.url().split('/').pop())});
page.on('requestfailed',r=>failed.push(r.url().slice(0,100)+' :: '+(r.failure()?.errorText??'')));
page.on('response',r=>{if(r.status()>=400)failed.push(r.url().slice(0,100)+' :: HTTP'+r.status())});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('https://pure281.github.io/VK_AutoChess/',{waitUntil:'networkidle2',timeout:45000});
await page.waitForSelector('.mode-card.pve',{timeout:20000});
await page.click('.mode-card.pve');
await page.waitForSelector('.board-canvas',{timeout:20000});
await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});
await sleep(1500);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());
await page.waitForSelector('.bench-slot.filled',{timeout:5000});
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());
await sleep(300);
const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null});
if(rect){
  const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,0.1,100);
  camera.position.set(7.6,8.7,9.5);camera.lookAt(3.5,0,3.45);camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const p=new THREE.Vector3(3,0,4).project(camera);
  await page.evaluate((x,y)=>document.querySelector('.board-canvas')?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y})),rect.left+((p.x+1)/2)*rect.width,rect.top+((1-p.y)/2)*rect.height);
}
await sleep(1500);
const deployed=await page.evaluate(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board??{}).length);
// wait for model to finish loading, then check debug state
let modelInfo=null;
for(let i=0;i<20;i++){
  modelInfo=await page.evaluate(()=>{
    const dbg=window.__board3dDebug;
    if(!dbg)return null;
    const units=Object.values(dbg.units??{});
    return{count:units.length,ready:units.filter(u=>u.modelReady).length,clips:units.map(u=>Object.keys(u.actions??{}).length)};
  }).catch(()=>null);
  if(modelInfo&&modelInfo.ready>0)break;
  await sleep(1000);
}
const badgeSeen=await page.evaluate(()=>Boolean(document.querySelector('.model-load-badge')));
await page.screenshot({path:'.verify/pages-final.png'});
console.log(JSON.stringify({deployed,glbRequests:glbRequests.slice(0,5),glbCount:glbRequests.length,modelInfo,badgeSeenNow:badgeSeen,failedCount:failed.length,failed:failed.slice(0,5),errors:errors.slice(0,6)},null,2));
await browser.close();
