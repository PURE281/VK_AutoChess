import WebSocket from 'ws';
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
function client(name){const ws=new WebSocket('ws://127.0.0.1:8787');const c={ws,name,latest:null,code:null};ws.on('message',raw=>{const m=JSON.parse(String(raw));if(m.type==='state'){c.latest=m;c.code=m.room.code}});c.open=new Promise((res,rej)=>{ws.on('open',res);ws.on('error',rej)});c.send=o=>ws.send(JSON.stringify(o));return c}
async function waitFor(fn,timeout=4000,label='condition'){const st=Date.now();while(Date.now()-st<timeout){const v=fn();if(v)return v;await sleep(80)}throw new Error('timeout '+label)}
const a=client('Alpha');let b=client('Beta');await Promise.all([a.open,b.open]);
a.send({type:'create',name:'Alpha'});await waitFor(()=>a.code,4000,'code');
b.send({type:'join',name:'Beta',code:a.code});await waitFor(()=>b.latest?.room.phase==='planning',4000,'join');
const code=a.code;b.ws.close();await sleep(350);
const disconnected=a.latest?.room.players[1]?.connected===false;
b=client('Beta');await b.open;b.send({type:'join',name:'Beta',code});
await waitFor(()=>b.latest?.room.phase==='planning'&&b.latest?.room.players[1]?.connected===true,4000,'reconnect');
console.log(JSON.stringify({code,disconnected,reconnected:true,seat:b.latest.room.you,phase:b.latest.room.phase}));a.ws.close();b.ws.close();
