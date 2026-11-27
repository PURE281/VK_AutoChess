import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cdp=await page.createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:280*1024,uploadThroughput:1024*1024});
const nav=page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:30000});
await sleep(1800);
const midLoad=await page.evaluate(()=>({
 splashOrReact:Boolean(document.querySelector('.loading-progress')||document.querySelector('.boot-splash')),
 hasBar:Boolean(document.querySelector('.loading-progress')),
 meta:document.querySelector('.loading-progress-meta')?.textContent??'',
 eta:document.querySelector('.loading-progress-eta')?.textContent??'',
 width:document.querySelector('.loading-progress-track i')?.style.width??''
}));
await nav.catch(()=>undefined);
await page.waitForSelector('.mode-card.pve',{timeout:30000});
const finalLoad=await page.evaluate(()=>({done:Boolean(document.querySelector('.mode-card.pve'))}));
// enter game, buy and deploy so a GLB download starts under throttle
await page.click('.mode-card.pve');
await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});
await sleep(500);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());
await page.waitForSelector('.bench-slot.filled',{timeout:4000});
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());
await sleep(200);
const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null});
if(rect){
  const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,0.1,100);
  camera.position.set(7.6,8.7,9.5);camera.lookAt(3.5,0,3.45);camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const p=new THREE.Vector3(3,0,4).project(camera);
  await page.evaluate((x,y)=>document.querySelector('.board-canvas')?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y})),rect.left+((p.x+1)/2)*rect.width,rect.top+((1-p.y)/2)*rect.height);
}
await sleep(1200);
const sample1=await page.evaluate(()=>({
 badge:Boolean(document.querySelector('.model-load-badge')),
 text:document.querySelector('.model-load-text span')?.textContent??'',
 width:document.querySelector('.model-load-track i')?.style.width??''
}));
await sleep(1500);
const sample2=await page.evaluate(()=>({
 badge:Boolean(document.querySelector('.model-load-badge')),
 text:document.querySelector('.model-load-text span')?.textContent??'',
 width:document.querySelector('.model-load-track i')?.style.width??''
}));
await page.screenshot({path:'.verify/model-load-badge.png'});
// remove throttle, let everything finish, confirm badge disappears
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
await sleep(4500);
const after=await page.evaluate(()=>({badgeGone:!document.querySelector('.model-load-badge')}));
console.log(JSON.stringify({midLoad,finalLoad,sample1,sample2,after,errors:errors.slice(0,8)},null,2));
await browser.close();
