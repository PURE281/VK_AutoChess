import WebSocket from 'ws';

const url = 'ws://127.0.0.1:8787';
function client(name) {
  const ws = new WebSocket(url);
  const c = { ws, name, packets: [], latest: null, code: null };
  ws.on('message', (raw) => {
    const msg = JSON.parse(String(raw));
    if (msg.type === 'state') {
      c.latest = msg;
      c.code = msg.room.code;
      c.packets.push(msg);
    }
  });
  c.open = new Promise((resolve, reject) => { ws.on('open', resolve); ws.on('error', reject); });
  c.send = (obj) => ws.send(JSON.stringify(obj));
  return c;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeout = 10000, label = 'condition') {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = fn();
    if (value) return value;
    await sleep(80);
  }
  throw new Error(`timeout waiting for ${label}`);
}
function prepare(c) {
  const game = c.latest.game;
  if (game.phase !== 'planning') throw new Error(`${c.name} not planning: ${game.phase}`);
  c.send({ type: 'action', action: { type: 'BUY_UNIT', slot: 0 } });
}
const a = client('Alpha');
const b = client('Beta');
await Promise.all([a.open, b.open]);
a.send({ type: 'create', name: 'Alpha' });
await waitFor(() => a.code, 5000, 'room code');
b.send({ type: 'join', name: 'Beta', code: a.code });
await waitFor(() => b.latest?.room.phase === 'planning' && a.latest?.room.phase === 'planning', 5000, 'both planning');
prepare(a);
await sleep(250);
prepare(b);
await sleep(350);
for (const c of [a, b]) {
  const benchIndex = c.latest.game.players[0].bench.findIndex(Boolean);
  if (benchIndex < 0) throw new Error(`${c.name} failed to buy`);
  c.send({ type: 'action', action: { type: 'MOVE_UNIT', from: { type: 'bench', index: benchIndex }, to: { type: 'board', x: 3, y: 0 } } });
}
await sleep(350);
for (const c of [a, b]) {
  if ((c.latest.game.players[0].board && Object.keys(c.latest.game.players[0].board).length) < 1) throw new Error(`${c.name} failed deploy`);
  c.send({ type: 'ready' });
}
const combat = await waitFor(() => a.latest?.room.phase === 'combat' && b.latest?.room.phase === 'combat', 5000, 'combat start');
const combatSummary = {
  aMode: a.latest.game.mode,
  bMode: b.latest.game.mode,
  aFrames: a.latest.game.combat?.result.frames.length,
  bFrames: b.latest.game.combat?.result.frames.length,
  aWinner: a.latest.game.combat?.result.winner,
  bWinner: b.latest.game.combat?.result.winner,
  mirroredWinner: a.latest.game.combat?.result.winner !== b.latest.game.combat?.result.winner,
  aPlayers: a.latest.game.players.length,
  bPlayers: b.latest.game.players.length,
};
await waitFor(() => a.latest?.room.phase === 'planning' && b.latest?.room.phase === 'planning', 24000, 'combat resolution');
await sleep(250);
const resolution = {
  round: a.latest.room.round,
  aPhase: a.latest.game.phase,
  bPhase: b.latest.game.phase,
  aHp: a.latest.game.players[0].hp,
  bHp: b.latest.game.players[0].hp,
  aGold: a.latest.game.players[0].gold,
  bGold: b.latest.game.players[0].gold,
  aXp: a.latest.game.players[0].xp,
  bXp: b.latest.game.players[0].xp,
  aReady: a.latest.room.players[0].ready,
  bReady: a.latest.room.players[1].ready,
};
console.log(JSON.stringify({ roomCode: a.code, combatStarted: Boolean(combat), combatSummary, resolution }, null, 2));
a.ws.close(); b.ws.close();
