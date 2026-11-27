import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage();page.on('console',m=>console.log('console',m.type(),m.text()));page.on('pageerror',e=>console.log('pageerror',e.message));
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
const r=await page.evaluate(async()=>{
 const mod=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
 const loader=new mod.GLTFLoader();
 const ab=await (await fetch('/assets/scenes/stg1100.glb')).arrayBuffer();
 return await new Promise(resolve=>{
  const timer=setTimeout(()=>resolve({result:'timeout'}),5000);
  try{loader.parse(ab,'/assets/scenes/',g=>{clearTimeout(timer);resolve({result:'success',nodes:g.scene.children.length})},e=>{clearTimeout(timer);resolve({result:'error',error:String(e&&e.message||e)})});}catch(e){clearTimeout(timer);resolve({result:'throw',error:String(e&&e.message||e)})}
 });
});
console.log(JSON.stringify(r));await browser.close();
