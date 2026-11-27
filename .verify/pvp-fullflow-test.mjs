import WebSocket from 'ws';
const url='ws://127.0.0.1:8787';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function client(name){const ws=new WebSocket(url);const c={ws,name,latest:null,code:null};ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='state'){c.latest=m;c.code=m.room.code}});c.open=new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});c.send=o=>ws.send(JSON.stringify(o));return c}
async function waitFor(fn,timeout,label){const start=Date.now();while(Date.now()-start<timeout){const v=fn();if(v)return v;await sleep(80)}throw new Error('timeout '+label)}
function me(c){return c.latest.game.players[0]}
function deployOne(c){
  const p=me(c);
  const benchIndex=p.bench.findIndex(Boolean);
  const occupied=new Set(Object.keys(p.board).map(k=>k.split(',').map(Number)));
  const limit=1+Math.floor(p.level/2);
  if(benchIndex>=0 && Object.keys(p.board).length<limit){
    for(let y=0;y<4;y++)for(let x=0;x<7;x++)if(!occupied.has([x,y])){c.send({type:'action',action:{type:'MOVE_UNIT',from:{type:'bench',index:benchIndex},to:{type:'board',x,y}}});return}
  }
}
function buyOne(c){
  const p=me(c);
  const idx=p.shop.findIndex(slot=>slot.championId && c.latest.game.pool[slot.championId]>0 && p.gold>=(c.latest.storeCosts?.[slot.championId]??1));
  // At low level all visible choices are normally affordable; server remains authoritative.
  const fallback=p.shop.findIndex(slot=>slot.championId);
  c.send({type:'action',action:{type:'BUY_UNIT',slot:idx>=0?idx:fallback}});
}
async function buyDeployReady(c){
  const before=me(c).bench.filter(Boolean).length+Object.keys(me(c).board).length;
  buyOne(c);
  await waitFor(()=>me(c).bench.filter(Boolean).length+Object.keys(me(c).board).length>before || me(c).shop.some(s=>!s.championId),1800,c.name+' buy').catch(()=>null);
  deployOne(c);
  await sleep(160);
  c.send({type:'ready'});
}
async function settlePending(c){
  const g=c.latest.game;
  if(g.phase==='item'&&g.pendingItem)c.send({type:'action',action:{type:'CHOOSE_ITEM',id:g.pendingItem.choices[0]}});
  if(g.phase==='augment'&&g.pendingAugment)c.send({type:'action',action:{type:'CHOOSE_AUGMENT',id:g.pendingAugment.choices[0]}});
}
const a=client('Alpha'),b=client('Beta');await Promise.all([a.open,b.open]);
a.send({type:'create',name:'Alpha'});await waitFor(()=>a.code,4000,'code');
b.send({type:'join',name:'Beta',code:a.code});
await waitFor(()=>a.latest?.room.phase==='planning'&&b.latest?.room.phase==='planning',4000,'start');
const rounds=[];
for(let round=1;round<=6;round++){
  await waitFor(()=>a.latest.game.phase==='planning'&&b.latest.game.phase==='planning',6000,'planning '+round);
  await buyDeployReady(a);await buyDeployReady(b);
  await waitFor(()=>a.latest.room.phase==='combat'&&b.latest.room.phase==='combat',5000,'combat '+round);
  const combat={round,winnerA:a.latest.game.combat.result.winner,winnerB:b.latest.game.combat.result.winner,frames:a.latest.game.combat.result.frames.length};
  a.send({type:'skip'});b.send({type:'skip'});
  await waitFor(()=>a.latest.room.phase!=='combat'&&b.latest.room.phase!=='combat',5000,'resolve '+round);
  await sleep(240);await settlePending(a);await settlePending(b);await sleep(320);await settlePending(a);await settlePending(b);
  const pa=me(a),pb=me(b);
  rounds.push({...combat,afterPhaseA:a.latest.game.phase,afterPhaseB:b.latest.game.phase,hp:[pa.hp,pb.hp],gold:[pa.gold,pb.gold],xp:[pa.xp,pb.xp],level:[pa.level,pb.level],board:[Object.keys(pa.board).length,Object.keys(pb.board).length],items:[pa.itemInventory.length,pb.itemInventory.length],augments:[pa.augments.length,pb.augments.length],poolEqual:JSON.stringify(a.latest.game.pool)===JSON.stringify(b.latest.game.pool),poolTotal:Object.values(a.latest.game.pool).reduce((x,y)=>x+y,0)});
  if(a.latest.game.phase==='gameover'||b.latest.game.phase==='gameover')break;
}
console.log(JSON.stringify({code:a.code,rounds},null,2));a.ws.close();b.ws.close();
