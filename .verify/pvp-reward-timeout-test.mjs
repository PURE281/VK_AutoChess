import WebSocket from 'ws';
const url='ws://127.0.0.1:8788';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function client(name){const ws=new WebSocket(url);const c={ws,name,latest:null,code:null};ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='state'){c.latest=m;c.code=m.room.code}});c.open=new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});c.send=o=>ws.send(JSON.stringify(o));return c}
async function waitFor(fn,timeout,label){const start=Date.now();while(Date.now()-start<timeout){const v=fn();if(v)return v;await sleep(70)}throw new Error('timeout '+label)}
function me(c){return c.latest.game.players[0]}
function action(c,action){c.send({type:'action',action})}
async function initialDeploy(c){const slot=me(c).shop.findIndex(x=>x.championId);action(c,{type:'BUY_UNIT',slot});await waitFor(()=>me(c).bench.some(Boolean),3000,'buy');action(c,{type:'MOVE_UNIT',from:{type:'bench',index:me(c).bench.findIndex(Boolean)},to:{type:'board',x:3,y:2}});await waitFor(()=>Object.keys(me(c).board).length>0,3000,'deploy')}
const a=client('Alpha'),b=client('Beta');await Promise.all([a.open,b.open]);a.send({type:'create',name:'Alpha'});await waitFor(()=>a.code,3000,'code');b.send({type:'join',name:'Beta',code:a.code});await waitFor(()=>a.latest?.room.phase==='planning'&&b.latest?.room.phase==='planning',3000,'join');await initialDeploy(a);await initialDeploy(b);a.send({type:'ready'});b.send({type:'ready'});await waitFor(()=>a.latest.game.phase==='combat'&&b.latest.game.phase==='combat',3000,'combat');a.send({type:'skip'});b.send({type:'skip'});await waitFor(()=>a.latest.game.phase==='item'&&b.latest.game.phase==='item',3000,'item');
const itemSeen={a:Boolean(a.latest.game.pendingItem),b:Boolean(b.latest.game.pendingItem)};
await waitFor(()=>me(a).itemInventory.length===1&&me(b).itemInventory.length===1&&a.latest.game.phase==='combat'&&b.latest.game.phase==='combat',7000,'auto reward and next combat');
console.log(JSON.stringify({itemSeen,phaseA:a.latest.game.phase,phaseB:b.latest.game.phase,items:[me(a).itemInventory.length,me(b).itemInventory.length],round:a.latest.game.round,logA:a.latest.game.log.slice(0,5)},null,2));a.ws.close();b.ws.close();
