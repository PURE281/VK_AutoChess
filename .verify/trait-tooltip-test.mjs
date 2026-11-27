import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'],defaultViewport:{width:1400,height:900}});
const page=await browser.newPage();const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:30000});
await page.waitForSelector('.mode-card.pve',{timeout:12000});await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)',{timeout:10000});await sleep(700);
await page.evaluate(()=>document.querySelector('.shop-card:not(.empty)')?.click());
await page.waitForSelector('.bench-slot.filled',{timeout:4000});
await page.evaluate(()=>document.querySelector('.bench-slot.filled')?.click());
await sleep(220);
const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas')?.getBoundingClientRect();return r?{left:r.left,top:r.top,width:r.width,height:r.height}:null});
if(rect){
  const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,0.1,100);
  camera.position.set(7.6,8.7,9.5);camera.lookAt(3.5,0,3.45);camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const p=new THREE.Vector3(3,0,4).project(camera);
  const cx=rect.left+((p.x+1)/2)*rect.width;
  const cy=rect.top+((1-p.y)/2)*rect.height;
  await page.evaluate((x,y)=>document.querySelector('.board-canvas')?.dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:x,clientY:y})),cx,cy);
}
await sleep(800);
const deployed=await page.evaluate(()=>Object.keys(window.__VALKYRIE_STATE__?.players[0].board??{}).length);
if(!deployed) throw new Error('failed to deploy unit for trait tooltip test');
await page.evaluate(()=>[...document.querySelectorAll('button')].find(x=>x.textContent?.trim()==='阵容')?.click());
await page.waitForSelector('.left-drawer.open .trait-row',{timeout:5000});
const row=await page.$('.left-drawer.open .trait-row');
const box=await row.boundingBox();
await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await sleep(350);
const result=await page.evaluate(()=>({
 traitRows:document.querySelectorAll('.trait-row').length,
 tooltip:Boolean(document.querySelector('.trait-tooltip-fixed')),
 tooltipText:document.querySelector('.trait-tooltip-fixed')?.textContent??'',
 stateText:document.querySelector('.trait-row .trait-state-text')?.textContent??''
}));
if(!result.tooltip) throw new Error('trait tooltip did not appear');
if(!/%/.test(result.tooltipText)) throw new Error('trait tooltip lacks percentage values');
await page.screenshot({path:'.verify/trait-tooltip.png'});
console.log(JSON.stringify({deployed,...result,tooltipPreview:result.tooltipText.slice(0,260),errors:errors.slice(0,8)},null,2));
await browser.close();
