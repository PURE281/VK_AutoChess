import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1366,height:900}});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,120)));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle2',timeout:40000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
await sleep(2200);
// dismiss notice if present
await page.evaluate(()=>{localStorage.setItem('vc_fan_notice_agreed','1');document.querySelector('.fan-notice-agree')?.click()});
await page.waitForSelector('.mode-card.pve',{timeout:15000});
await page.click('.mode-card.pve');
await page.waitForSelector('.board-canvas',{timeout:15000});
await sleep(1500);
const before=await page.evaluate(()=>window.__board3dDebug?.cameraRadius);
// simulate two-finger pinch IN (fingers move apart => zoom in => radius shrinks)
const result=await page.evaluate(async()=>{
  const canvas=document.querySelector('.board-canvas');
  const r=canvas.getBoundingClientRect();
  const cx=r.left+r.width/2, cy=r.top+r.height/2;
  const fire=(type,id,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,button:0,bubbles:true,cancelable:true}));
  const radii=[];
  fire('pointerdown',1,cx-40,cy);fire('pointerdown',2,cx+40,cy);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  // spread fingers apart over several steps
  for(let d=40;d<=140;d+=20){fire('pointermove',1,cx-d,cy);fire('pointermove',2,cx+d,cy);await sleep(60);radii.push(window.__board3dDebug?.cameraRadius)}
  fire('pointerup',1,cx-140,cy);fire('pointerup',2,cx+140,cy);
  const afterSpread=window.__board3dDebug?.cameraRadius;
  // pinch together => zoom out => radius grows
  fire('pointerdown',1,cx-140,cy);fire('pointerdown',2,cx+140,cy);
  for(let d=140;d>=40;d-=20){fire('pointermove',1,cx-d,cy);fire('pointermove',2,cx+d,cy);await sleep(60)}
  fire('pointerup',1,cx-40,cy);fire('pointerup',2,cx+40,cy);
  return{afterSpread,afterPinch:window.__board3dDebug?.cameraRadius};
});
console.log(JSON.stringify({before,spreadResult:result,errors:errors.slice(0,4)}));
await browser.close();
