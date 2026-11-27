import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
const glbRequests=[];page.on('request',r=>{if(r.url().includes('.glb'))glbRequests.push(r.url().split('/').pop())});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const cdp=await page.createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:60,downloadThroughput:350*1024,uploadThroughput:1024*1024});
const nav=page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded',timeout:30000});
// poll loading screen until it disappears or lobby appears
let barSample=null;let splashSeen=false;
for(let i=0;i<90;i++){
  const st=await page.evaluate(()=>({
    splash:Boolean(document.querySelector('.boot-splash')),
    bar:Boolean(document.querySelector('.loading-progress')),
    meta:document.querySelector('.loading-progress-meta')?.textContent??'',
    eta:document.querySelector('.loading-progress-eta')?.textContent??'',
    width:document.querySelector('.loading-progress-track i')?.style.width??'',
    lobby:Boolean(document.querySelector('.mode-card.pve'))
  })).catch(()=>({splash:false,bar:false,meta:'',eta:'',width:'',lobby:false}));
  if(st.splash)splashSeen=true;
  if(st.bar&&(st.width!=="4%"||st.meta.includes("/")))barSample={meta:st.meta,eta:st.eta,width:st.width};
  if(st.lobby)break;
  await sleep(250);
}
await nav.catch(()=>undefined);
await page.waitForSelector('.mode-card.pve',{timeout:30000});
await page.click('.mode-card.pve');
await page.waitForSelector('.board-canvas',{timeout:20000});
await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});
await sleep(400);
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
await sleep(600);
const deployed=await page.evaluate(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board??{}).length);
// poll badge
let badgeSample=null;
for(let i=0;i<30;i++){
  const st=await page.evaluate(()=>({
    badge:Boolean(document.querySelector('.model-load-badge')),
    text:document.querySelector('.model-load-text span')?.textContent??'',
    width:document.querySelector('.model-load-track i')?.style.width??''
  }));
  if(st.badge){badgeSample=st;if(st.width&&st.width!=='4%')break}
  await sleep(200);
}
if(badgeSample)await page.screenshot({path:'.verify/model-load-badge.png'});
await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
await sleep(5000);
const after=await page.evaluate(()=>({badgeGone:!document.querySelector('.model-load-badge')}));
console.log(JSON.stringify({splashSeen,barSample,deployed,glbRequests,badgeSample,after,errors:errors.slice(0,8)},null,2));
await browser.close();
