import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--use-angle=swiftshader'],defaultViewport:{width:1500,height:950}});
const page=await browser.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.shop-card:not(.empty)');
// Buy XP once, then purchase up to three affordable units.
await page.evaluate(()=>{[...document.querySelectorAll('.shop-actions button')].find(b=>b.textContent.includes('研习'))?.click()});
await new Promise(r=>setTimeout(r,250));
for(let n=0;n<3;n++){
  const clicked=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.shop-card:not(.empty):not(.soldout)')];
    const c=cards.find(x=>!x.className.includes('disabled') && !x.className.includes('unaffordable'))||cards[0];
    if(!c)return false;c.click();return true;
  });
  if(!clicked)break;
  await new Promise(r=>setTimeout(r,320));
}
const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}});
function point(x,z){const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,.1,100);camera.position.set(7.6,8.7,9.5);camera.lookAt(3.5,0,3.45);camera.updateMatrixWorld();camera.updateProjectionMatrix();const p=new THREE.Vector3(x,0,z).project(camera);return [rect.left+(p.x+1)/2*rect.width,rect.top+(1-p.y)/2*rect.height]}
for(const [slot,x,z] of [[0,2,4],[1,4,4],[2,3,5]]){
  const has=await page.evaluate((i)=>{const el=document.querySelectorAll('.bench-slot.filled')[i];if(!el)return false;el.click();return true},slot);
  if(!has)break; await new Promise(r=>setTimeout(r,160));
  const pt=point(x,z); await page.mouse.click(pt[0],pt[1]); await new Promise(r=>setTimeout(r,450));
}
const deployed=await page.evaluate(()=>document.querySelector('.board-3d-caption')?.textContent);
await page.click('.start-combat');
await new Promise(r=>setTimeout(r,2500));
const fps=await page.evaluate(()=>new Promise(resolve=>{let n=0;const start=performance.now();function f(){n++;if(performance.now()-start<2000)requestAnimationFrame(f);else resolve(n/2)}requestAnimationFrame(f)}));
const debug=await page.evaluate(()=>window.__board3dDebug);
const memory=await page.evaluate(()=>performance.memory?{usedMB:Math.round(performance.memory.usedJSHeapSize/1048576),totalMB:Math.round(performance.memory.totalJSHeapSize/1048576)}:null);
await page.screenshot({path:'.verify/3d-stress.png'});
console.log(JSON.stringify({deployed,fps,memory,debug,errors},null,2));
await browser.close();
