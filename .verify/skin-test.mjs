import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu','--no-sandbox','--enable-unsafe-swiftshader'],defaultViewport:{width:1400,height:900}});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const page=await browser.newPage();
page.on('console',m=>{if(m.type()==='error')console.log('ERR',m.text().slice(0,150))});
await page.goto('http://127.0.0.1:5173/VK_AutoChess/',{waitUntil:'networkidle2',timeout:30000});
await sleep(2000);
// bypass fan notice if present
const agreed=await page.evaluate(()=>{
  const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('同意'));
  if(btn){btn.click();return true}return false;
});
await sleep(1200);
// open codex (图鉴)
await page.evaluate(()=>{
  const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('图鉴'));
  if(btn)btn.click();
});
await sleep(1500);
await page.screenshot({path:'.verify/skin-codex.png'});
// find 斯库尔德 in codex and click
const clicked=await page.evaluate(()=>{
  const els=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.includes('斯库尔德')&&!e.textContent.includes('常夏'));
  if(els.length){els[0].click();return els[0].textContent.slice(0,20)}
  return null;
});
console.log('codex click:',clicked,'agreed:',agreed);
await sleep(1500);
await page.screenshot({path:'.verify/skin-detail.png'});
// check skin picker presence
const picker=await page.evaluate(()=>{
  const sp=document.querySelector('.skin-picker');
  if(!sp)return 'NO-PICKER';
  const opts=[...sp.querySelectorAll('.skin-option')];
  return `picker with ${opts.length} options, active=${sp.querySelector('.skin-option.active')?1:0}`;
});
console.log('picker:',picker);
// click second skin option
await page.evaluate(()=>{
  const opts=[...document.querySelectorAll('.skin-option')];
  if(opts[1])opts[1].click();
});
await sleep(1200);
await page.screenshot({path:'.verify/skin-swapped.png'});
const after=await page.evaluate(()=>{
  const active=document.querySelector('.skin-option.active img');
  return active?active.alt:'none';
});
console.log('active skin after click:',after);
console.log('localStorage:',await page.evaluate(()=>localStorage.getItem('vk-autochess-skins')));
await browser.close();
