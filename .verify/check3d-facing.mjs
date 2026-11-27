import puppeteer from 'puppeteer-core';
import * as THREE from 'three';
import fs from 'node:fs';
const roster=JSON.parse(fs.readFileSync('public/data/roster.json','utf8'));
const roles=new Map(roster.characters.map(c=>[c.id,c.role]));
const rangedRoles=new Set(['ranger','arcanist','warlock','priest']);
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--use-angle=swiftshader'],defaultViewport:{width:1500,height:950}});
const page=await browser.newPage();
const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'domcontentloaded'});
await page.waitForSelector('.shop-card:not(.empty)');
const pick=await page.evaluate((rangedIds)=>{
  const state=window.__VALKYRIE_STATE__;
  const index=state.players[0].shop.findIndex(slot=>slot.championId&&rangedIds.includes(slot.championId));
  return {index,shop:state.players[0].shop.map(s=>s.championId)};
},roster.characters.filter(c=>rangedRoles.has(c.role)).map(c=>c.id));
if(pick.index<0) throw new Error('no ranged unit in initial shop: '+JSON.stringify(pick));
const championId=(await page.evaluate((i)=>window.__VALKYRIE_STATE__.players[0].shop[i].championId,pick.index));
await page.evaluate((i)=>document.querySelectorAll('.shop-card:not(.empty)')[i].click(),pick.index);
await new Promise(r=>setTimeout(r,450));
await page.click('.bench-slot.filled'); await new Promise(r=>setTimeout(r,200));
const rect=await page.evaluate(()=>{const r=document.querySelector('.board-canvas').getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height}});
const camera=new THREE.PerspectiveCamera(42,rect.width/rect.height,.1,100); camera.position.set(7.6,8.7,9.5); camera.lookAt(3.5,0,3.45); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
const p=new THREE.Vector3(3,0,4).project(camera);
await page.mouse.click(rect.left+(p.x+1)/2*rect.width,rect.top+(1-p.y)/2*rect.height);
await new Promise(r=>setTimeout(r,900));
await page.click('.start-combat');
let sample=null;
for(let i=0;i<56;i++){
  await new Promise(r=>setTimeout(r,160));
  sample=await page.evaluate(()=>{
    const dbg=window.__board3dDebug;
    const st=window.__VALKYRIE_STATE__;
    if(!dbg||!st?.combat) return null;
    return {units:dbg.units,events:st.combat.result.events,phase:st.phase};
  });
  if(sample?.units?.some(u=>u.targetId!=null && u.current && (u.current.includes("@attack") || u.current.includes("@auto")))) break;
}
const result=(sample?.units??[]).map(u=>{
  const events=(sample.events??[]).filter(e=>e.source===Number(String(u.key).slice(1))&&(e.type==='attack'||e.type==='skill'));
  const last=events[events.length-1];
  const expected=u.faceX==null?null:Math.atan2(u.faceX-u.x,u.faceZ-u.z);
  const err=expected==null?null:Math.atan2(Math.sin(expected-u.rotation),Math.cos(expected-u.rotation));
  return {championId:u.championId,role:roles.get(u.championId),clip:u.current,targetId:u.targetId,lastEventTarget:last?.target??null,rotation:u.rotation,expected,angularErrorDeg:err==null?null:err*180/Math.PI,x:u.x,z:u.z,faceX:u.faceX,faceZ:u.faceZ};
});
await page.screenshot({path:'.verify/3d-facing-check.png'});
console.log(JSON.stringify({picked:{championId,role:roles.get(championId)},result,errors},null,2));
await browser.close();
