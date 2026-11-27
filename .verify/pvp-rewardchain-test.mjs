import WebSocket from 'ws';
const url='ws://127.0.0.1:8787';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(name){const ws=new WebSocket(url);const c={ws,name,latest:null,code:null};ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='state'){c.latest=m;c.code=m.room.code}});c.open=new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});c.send=o=>ws.send(JSON.stringify(o));return c}
async function waitFor(fn,timeout,label){const start=Date.now();while(Date.now()-start<timeout){const v=fn();if(v)return v;await sleep(70)}throw new Error('timeout '+label)}
function me(c){return c.latest.game.players[0]}
function action(c,action){c.send({type:'action',action})}
async function initialDeploy(c){await waitFor(()=>c.latest?.game.phase==='planning',4000,'planning');const slot=me(c).shop.findIndex(x=>x.championId);action(c,{type:'BUY_UNIT',slot});await waitFor(()=>me(c).bench.some(Boolean),3000,'buy');const bench=me(c).bench.findIndex(Boolean);action(c,{type:'MOVE_UNIT',from:{type:'bench',index:bench},to:{type:'board',x:3,y:2}});await waitFor(()=>Object.keys(me(c).board).length>0,3000,'deploy')}
async function chooseCurrent(c){const g=c.latest.game;if(g.phase==='item'&&g.pendingItem)action(c,{type:'CHOOSE_ITEM',id:g.pendingItem.choices[0]});else if(g.phase==='augment'&&g.pendingAugment)action(c,{type:'CHOOSE_AUGMENT',id:g.pendingAugment.choices[0]});else throw new Error('no pending reward')}
const a=client('Alpha'),b=client('Beta');await Promise.all([a.open,b.open]);a.send({type:'create',name:'Alpha'});await waitFor(()=>a.code,4000,'code');b.send({type:'join',name:'Beta',code:a.code});await waitFor(()=>a.latest?.room.phase==='planning'&&b.latest?.room.phase==='planning',4000,'join');await initialDeploy(a);await initialDeploy(b);
const rounds=[];
for(let round=1;round<=3;round++){
 await waitFor(()=>a.latest.game.phase==='planning'&&b.latest.game.phase==='planning',5000,'planning r'+round);
 a.send({type:'ready'});b.send({type:'ready'});
 await waitFor(()=>a.latest.game.phase==='combat'&&b.latest.game.phase==='combat',4000,'combat r'+round);
 a.send({type:'skip'});b.send({type:'skip'});
 await waitFor(()=>a.latest.game.phase==='item'&&b.latest.game.phase==='item',4000,'item r'+round);
 const itemSnapshot={round,phaseA:a.latest.game.phase,phaseB:b.latest.game.phase,pendingA:a.latest.game.pendingItem?.choices.length,pendingB:b.latest.game.pendingItem?.choices.length};
 await chooseCurrent(a);await chooseCurrent(b);
 if(round===3){
   await waitFor(()=>a.latest.game.phase==='augment'&&b.latest.game.phase==='augment',4000,'augment chain');
   itemSnapshot.afterItemPhaseA=a.latest.game.phase;itemSnapshot.afterItemPhaseB=b.latest.game.phase;itemSnapshot.augmentA=a.latest.game.pendingAugment?.choices.length;itemSnapshot.augmentB=b.latest.game.pendingAugment?.choices.length;
   await chooseCurrent(a);await chooseCurrent(b);
 }else{
   itemSnapshot.afterItemPhaseA='planning-expected';itemSnapshot.afterItemPhaseB='planning-expected';
 }
 await waitFor(()=>a.latest.game.phase==='planning'&&b.latest.game.phase==='planning',4000,'back planning r'+round);
 itemSnapshot.finalA=a.latest.game.phase;itemSnapshot.finalB=b.latest.game.phase;itemSnapshot.items=[me(a).itemInventory.length,me(b).itemInventory.length];itemSnapshot.augments=[me(a).augments.length,me(b).augments.length];rounds.push(itemSnapshot);
}
console.log(JSON.stringify({rounds},null,2));a.ws.close();b.ws.close();
