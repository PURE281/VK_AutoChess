import WebSocket from 'ws';
const url='ws://127.0.0.1:8787';
function client(name){const ws=new WebSocket(url);const c={ws,name,latest:null,code:null};ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='state'){c.latest=m;c.code=m.room.code}});c.open=new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});c.send=o=>ws.send(JSON.stringify(o));return c}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function waitFor(fn,label,timeout=6000){const st=Date.now();while(Date.now()-st<timeout){const v=fn();if(v)return v;await sleep(80)}throw new Error('timeout '+label)}
const a=client('PoolA'),b=client('PoolB');await Promise.all([a.open,b.open]);
a.send({type:'create',name:'PoolA',poolGroups:['collab_fate']});
await waitFor(()=>a.code,'code');
b.send({type:'join',name:'PoolB',code:a.code});
await waitFor(()=>a.latest?.room.phase==='planning'&&b.latest?.room.phase==='planning','planning');
await sleep(250);
const roster=await import('node:fs').then(fs=>JSON.parse(fs.readFileSync('public/data/roster.json','utf8')));
const byId=new Map(roster.characters.map(c=>[c.id,c]));
const shopIds=a.latest.game.players[0].shop.map(s=>s.championId).filter(Boolean);
const active=a.latest.game.activeRoster;
const activeSet=new Set(active);
const invalid=active.filter(id=>!byId.has(id));
const shopInvalid=shopIds.filter(id=>!activeSet.has(id));
console.log(JSON.stringify({roomGroups:a.latest.room.poolGroups,poolSize:a.latest.room.poolSize,activeCount:active.length,shopIds,invalidCount:invalid.length,shopInvalidCount:shopInvalid.length,bActiveCount:b.latest.game.activeRoster.length,sameRoster:JSON.stringify(active)===JSON.stringify(b.latest.game.activeRoster)},null,2));
a.ws.close();b.ws.close();
