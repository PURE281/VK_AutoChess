import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1400,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(true)errors.push(m.type()+': '+m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2'});await page.waitForSelector('.mode-card.pve');await page.click('.mode-card.pve');await page.waitForSelector('.shop-card:not(.empty)');await new Promise(r=>setTimeout(r,8000));
const info=await page.evaluate(async()=>{
 const d=window.__vcStageDebug;if(!d)return {missing:true,state:window.__vcStageState};
 const THREE=await import('/node_modules/three/build/three.module.js');
 const out={missing:false,children:[],camera:d.camera.position.toArray()};
 d.environment.updateMatrixWorld(true);
 d.environment.traverse(o=>{if(o.isMesh){const box=new THREE.Box3().setFromObject(o);out.children.push({name:o.name,visible:o.visible,min:box.min.toArray(),max:box.max.toArray(),mat:(Array.isArray(o.material)?o.material[0]:o.material)?.name,side:(Array.isArray(o.material)?o.material[0]:o.material)?.side});}});
 return out;
});
console.log(JSON.stringify({info,errors},null,2));await browser.close();
