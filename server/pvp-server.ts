import { readFileSync } from "node:fs";
import { WebSocketServer, WebSocket } from "ws";
import type { Champion, CombatResult, GameState, PlayerState, RosterDataset, UnitInstance } from "../src/types";
import type { DataStore } from "../src/data";
import { createGameReducer, createInitialState, type GameAction } from "../src/game/engine";
import { simulateCombat, type CombatEntry, type CombatTeamInput } from "../src/game/combat";
import { XP_TO_NEXT } from "../src/game/definitions";
import { boardCount, createPool, deployLimit, rollShop } from "../src/game/roster";
import { combatTraitLevels } from "../src/game/synergies";
import { mulberry32 } from "../src/game/random";
import { chooseBalancedAugments, chooseBalancedItems, hpComebackGoldBonus, lossStreakGoldBonus, winStreakGoldBonus } from "../src/game/balance";
import { championsForPoolGroups, normalizePoolGroups } from "../src/game/poolGroups";

const PORT = Number(process.env.PVP_PORT ?? 8787);

const dataset = JSON.parse(readFileSync(new URL("../public/data/roster.json", import.meta.url), "utf8")) as RosterDataset;
const champions = new Map<number, Champion>();
for (const champion of dataset.characters) champions.set(champion.id, champion);
const store: DataStore = {
  dataset,
  champions,
  season1: dataset.seasons.season1.map((id) => champions.get(id)).filter((c): c is Champion => Boolean(c)),
};
const reducer = createGameReducer(store);

interface ClientPlayer {
  ws: WebSocket;
  seat: number;
  name: string;
  state: GameState;
  ready: boolean;
  skip: boolean;
  connected: boolean;
}

interface Room {
  code: string;
  players: Array<ClientPlayer | null>;
  round: number;
  phase: "waiting" | "planning" | "combat" | "gameover";
  seed: number;
  pool: Record<number, number>;
  poolGroups: string[];
  poolSize: number;
  resolving: boolean;
  planningDeadline?: number;
}

const rooms = new Map<string, Room>();
const PLANNING_TIME_MS = Number(process.env.PVP_PLANNING_MS ?? 60_000);

function send(ws: WebSocket, message: unknown): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

function roomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let code = "";
    for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!rooms.has(code)) return code;
  }
}

function publicPlayer(player: ClientPlayer | null) {
  if (!player) return null;
  const me = player.state.players[0];
  return {
    name: player.name,
    seat: player.seat,
    hp: me.hp,
    level: me.level,
    gold: me.gold,
    board: boardCount(me),
    deployLimit: deployLimit(me),
    ready: player.ready,
    connected: player.connected,
    phase: player.state.phase,
  };
}

function broadcast(room: Room): void {
  for (const player of room.players) {
    if (!player) continue;
    const opponent = room.players[player.seat === 0 ? 1 : 0];
    send(player.ws, {
      type: "state",
      room: {
        code: room.code,
        round: room.round,
        phase: room.phase,
        you: player.seat,
        players: room.players.map(publicPlayer),
        opponentName: opponent?.name ?? "等待对手",
        poolGroups: room.poolGroups,
        poolSize: room.poolSize,
        planningDeadline: room.phase === "planning" ? room.planningDeadline : undefined,
        serverNow: Date.now(),
      },
      game: player.state,
    });
  }
}

function entriesFromPlayer(player: PlayerState, side: "player" | "enemy"): CombatEntry[] {
  const entries: CombatEntry[] = [];
  for (const [key, unit] of Object.entries(player.board)) {
    const [x, localY] = key.split(",").map(Number);
    const champion = champions.get(unit.championId);
    if (!champion) continue;
    entries.push({ unit, champion, x, y: side === "player" ? 4 + localY : 3 - localY });
  }
  return entries;
}

function inputFromPlayer(player: PlayerState, side: "player" | "enemy"): CombatTeamInput {
  return {
    entries: entriesFromPlayer(player, side),
    traits: combatTraitLevels(player, champions),
    augments: player.augments,
    powerBonus: 1,
    lowHp: player.hp <= 35,
  };
}

function mirrorCombat(result: CombatResult): CombatResult {
  const flipY = (y?: number) => y == null ? y : 7 - y;
  const mirror: CombatResult = structuredClone(result);
  mirror.winner = result.winner === "player" ? "enemy" : result.winner === "enemy" ? "player" : "draw";
  mirror.survivingPlayer = result.survivingEnemy;
  mirror.survivingEnemy = result.survivingPlayer;
  mirror.playerUnitsLeft = result.enemyUnitsLeft;
  mirror.enemyUnitsLeft = result.playerUnitsLeft;
  for (const frame of mirror.frames) for (const unit of frame.units) unit.y = 7 - unit.y;
  for (const event of mirror.events) {
    event.y = flipY(event.y);
    event.y2 = flipY(event.y2);
  }
  for (const label of Object.values(mirror.unitLabels)) label.side = label.side === "player" ? "enemy" : "player";
  return mirror;
}

function playerDamageFor(round: number, unitsLeft: number, survivingPct: number): number {
  return Math.max(1, Math.round(2 + round * 0.48 + unitsLeft * 1.35 + survivingPct * 2.2));
}

function levelUp(player: PlayerState, amount: number): string[] {
  const messages: string[] = [];
  player.xp += amount;
  while (player.level < 9) {
    const need = XP_TO_NEXT[player.level] ?? 999;
    if (player.xp < need) break;
    player.xp -= need;
    player.level += 1;
    messages.push(`等级提升到 ${player.level}`);
  }
  return messages;
}

function pushLog(state: GameState, message: string): void {
  state.log.unshift(message);
  state.log = state.log.slice(0, 90);
}

function beginCombatIfReady(room: Room): void {
  if (room.phase !== "planning" || room.resolving) return;
  const host = room.players[0];
  const guest = room.players[1];
  if (!host?.ready || !guest?.ready) return;
  if (host.state.phase !== "planning" || guest.state.phase !== "planning") return;
  const hostPlayer = host.state.players[0];
  const guestPlayer = guest.state.players[0];
  const timedOut = Boolean(room.planningDeadline && Date.now() >= room.planningDeadline);
  if (!timedOut && (!boardCount(hostPlayer) || !boardCount(guestPlayer))) return;

  room.phase = "combat";
  room.planningDeadline = undefined;
  room.resolving = true;
  const seed = room.seed + room.round * 131071;
  const result = simulateCombat(inputFromPlayer(hostPlayer, "player"), inputFromPlayer(guestPlayer, "enemy"), seed);
  const startedAt = Date.now();

  host.state.combat = {
    round: room.round,
    roundType: "pvp",
    opponentId: 1,
    opponentName: guest.name,
    result,
    startedAt,
  };
  guest.state.combat = {
    round: room.round,
    roundType: "pvp",
    opponentId: 0,
    opponentName: host.name,
    result: mirrorCombat(result),
    startedAt,
  };
  host.skip = false;
  guest.skip = false;
  host.state.phase = "combat";
  guest.state.phase = "combat";
  pushLog(host.state, `第 ${room.round} 回合真人对战开始：对阵 ${guest.name}`);
  pushLog(guest.state, `第 ${room.round} 回合真人对战开始：对阵 ${host.name}`);

  const waitMs = Math.min(48000, result.duration * 1000 + 1700);
  setTimeout(() => resolveCombat(room, result), waitMs);
}

function resolveCombat(room: Room, result: CombatResult): void {
  if (!rooms.has(room.code) || room.phase !== "combat") return;
  const host = room.players[0];
  const guest = room.players[1];
  if (!host || !guest) return;
  const hostMe = host.state.players[0];
  const guestMe = guest.state.players[0];
  const hostWon = result.winner === "player";
  const guestWon = result.winner === "enemy";
  const draw = result.winner === "draw";
  const completedRound = room.round;

  for (const [player, won] of [[host, hostWon], [guest, guestWon]] as Array<[ClientPlayer, boolean]>) {
    const me = player.state.players[0];
    if (won) {
      me.winStreak += 1;
      me.lossStreak = 0;
    } else if (!draw) {
      me.lossStreak += 1;
      me.winStreak = 0;
      const unitsLeft = player.seat === 0 ? result.enemyUnitsLeft : result.playerUnitsLeft;
      const surviving = player.seat === 0 ? result.survivingEnemy : result.survivingPlayer;
      const damage = playerDamageFor(completedRound, unitsLeft, surviving);
      me.hp = Math.max(0, me.hp - damage);
      pushLog(player.state, `第 ${completedRound} 回合战败，受到 ${damage} 点伤害。`);
    } else {
      me.hp = Math.max(0, me.hp - 3);
      pushLog(player.state, `第 ${completedRound} 回合平局，双方受到 3 点伤害。`);
    }
    const interest = Math.min(me.augments.includes("gold_flow") ? 7 : 5, Math.floor(me.gold / 10));
    const winGold = winStreakGoldBonus(me.winStreak);
    const lossGold = lossStreakGoldBonus(me.lossStreak);
    me.gold += 5 + interest + winGold + lossGold + (me.augments.includes("gold_flow") ? 1 : 0);
    if (won) {
      if (me.augments.includes("war_treasury")) me.gold += 2;
      const humanRaceLevel = combatTraitLevels(me, champions).races[2] ?? 0;
      if (humanRaceLevel > 0) me.gold += humanRaceLevel;
    }
    if (!won && !draw && lossGold > 0) {
      pushLog(player.state, `连败追赶加成：本回合连败补贴 +${lossGold} 金币，神器/符文高品质权重提升。`);
    }
    for (const message of levelUp(me, 2)) pushLog(player.state, message);
    player.state.combat = null;
    player.state.phase = "planning";
    player.state.round = completedRound + 1;
    player.state.roundType = "pvp";
    player.ready = false;
    player.skip = false;
  }

  const hostHpBonus = hpComebackGoldBonus(hostMe.hp, guestMe.hp);
  const guestHpBonus = hpComebackGoldBonus(guestMe.hp, hostMe.hp);
  if (hostHpBonus) {
    hostMe.gold += hostHpBonus;
    pushLog(host.state, `血量落后补偿：额外获得 +${hostHpBonus} 金币。`);
  }
  if (guestHpBonus) {
    guestMe.gold += guestHpBonus;
    pushLog(guest.state, `血量落后补偿：额外获得 +${guestHpBonus} 金币。`);
  }

  if (hostWon) pushLog(host.state, `第 ${completedRound} 回合胜利：你击败了 ${guest.name}。`);
  if (guestWon) pushLog(guest.state, `第 ${completedRound} 回合胜利：你击败了 ${host.name}。`);

  const hostDead = hostMe.hp <= 0;
  const guestDead = guestMe.hp <= 0;
  if (hostDead || guestDead) {
    room.phase = "gameover";
    for (const player of [host, guest]) {
      const me = player.state.players[0];
      const won = player.seat === 0 ? guestDead && !hostDead : hostDead && !guestDead;
      me.alive = me.hp > 0;
      player.state.phase = "gameover";
      player.state.gameResult = won ? "victory" : "defeat";
      pushLog(player.state, won ? "你赢得了真人对决！" : "你在真人对决中被淘汰。");
    }
    broadcast(room);
    return;
  }

  room.round += 1;
  room.phase = "planning";
  room.planningDeadline = Date.now() + PLANNING_TIME_MS;
  room.resolving = false;
  host.state.pool = structuredClone(room.pool);
  guest.state.pool = structuredClone(room.pool);

  const augmentRound = [3, 8, 13].includes(completedRound);
  for (const player of [host, guest]) {
    const me = player.state.players[0];
    player.state.pendingItem = { choices: chooseBalancedItems(mulberry32(room.seed + completedRound * 171717 + player.seat * 37), me.lossStreak, 3, me.winStreak).map((item) => item.id), round: completedRound };
    const augmentChoices = augmentRound ? chooseBalancedAugments(mulberry32(room.seed + completedRound * 424243 + player.seat * 91), completedRound, me.augments, me.lossStreak, 3, me.winStreak).map((augment) => augment.id) : [];
    player.state.pendingAugment = augmentChoices.length ? { choices: augmentChoices, round: completedRound } : null;
    player.state.phase = "item";
    const rewardLog = player.state.pendingAugment ? "战后奖励：选择 1 件神器，随后选择 1 个强化符文。" : "战后奖励：选择 1 件神器。";
    pushLog(player.state, me.lossStreak >= 2 ? `${rewardLog}连败补给已提高高品质奖励权重。` : rewardLog);
  }
  broadcast(room);
}

function createPlayer(ws: WebSocket, seat: number, name: string, seed: number, sharedPool: Record<number, number> | undefined, poolGroups: string[]): { player: ClientPlayer; pool: Record<number, number> } {
  const state = createInitialState(store, seed + seat * 7919, "trial");
  const roster = championsForPoolGroups(dataset, poolGroups);
  const rng = mulberry32(seed + seat * 7919 + 404);
  state.activeRoster = roster.map((champion) => champion.id);
  state.pool = createPool(roster);
  state.players[0].shop = rollShop(state.players[0], state.pool, roster, rng);
  state.mode = "pvp";
  state.roundType = "pvp";
  state.log = [`真人决斗房间已创建。角色池：${roster.length} 名角色。轮到你整备，布置棋子后点击开始战斗。`];
  let pool = sharedPool ? structuredClone(sharedPool) : structuredClone(state.pool);
  if (sharedPool) {
    // The initial shop was rolled before the shared pool existed. Remove those
    // five held copies so both players compete over one authoritative card pool.
    for (const slot of state.players[0].shop) {
      if (slot.championId) pool[slot.championId] = Math.max(0, (pool[slot.championId] ?? 0) - 1);
    }
    state.pool = structuredClone(pool);
  }
  return { player: { ws, seat, name, state, ready: false, skip: false, connected: true }, pool };
}

function joinRoom(ws: WebSocket, rawCode: string, name: string): void {
  const code = rawCode.trim().toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    send(ws, { type: "error", message: "房间不存在。" });
    return;
  }
  const reconnecting = room.players.find((player) => player && !player.connected && player.name === name);
  if (reconnecting) {
    reconnecting.ws = ws;
    reconnecting.connected = true;
    broadcast(room);
    return;
  }
  const seat = room.players[0] ? (room.players[1] ? -1 : 1) : 0;
  if (seat < 0) {
    send(ws, { type: "error", message: "房间已满。" });
    return;
  }
  const created = createPlayer(ws, seat, name, room.seed, room.pool, room.poolGroups);
  room.pool = created.pool;
  const player = created.player;
  room.players[seat] = player;
  if (room.players[0]) room.players[0].state.pool = structuredClone(room.pool);
  if (room.players[0] && room.players[1]) {
    room.phase = "planning";
    room.planningDeadline = Date.now() + PLANNING_TIME_MS;
    for (const p of room.players) if (p) pushLog(p.state, `对手已加入，真人自走棋对决开始！准备阶段倒计时 ${Math.round(PLANNING_TIME_MS / 1000)} 秒。`);
  }
  broadcast(room);
}

function createRoom(ws: WebSocket, name: string, selectedPoolGroups: unknown): void {
  const code = roomCode();
  const seed = Date.now() % 1000000000;
  const poolGroups = normalizePoolGroups(selectedPoolGroups);
  const roster = championsForPoolGroups(dataset, poolGroups);
  const created = createPlayer(ws, 0, name, seed, undefined, poolGroups);
  const room: Room = { code, players: [null, null], round: 1, phase: "waiting", seed, pool: created.pool, poolGroups, poolSize: roster.length, resolving: false };
  room.players[0] = created.player;
  rooms.set(code, room);
  broadcast(room);
}

function hostCombatResult(room: Room): CombatResult | null {
  const result = room.players[0]?.state.combat?.result ?? null;
  return result;
}

function applyPlayerAction(room: Room, player: ClientPlayer, action: GameAction): void {
  player.state.pool = structuredClone(room.pool);
  player.state = reducer(player.state, action);
  room.pool = structuredClone(player.state.pool);
  const opponent = room.players[player.seat === 0 ? 1 : 0];
  if (opponent) opponent.state.pool = structuredClone(room.pool);
}

function autoResolveRewards(room: Room, player: ClientPlayer): void {
  for (let guard = 0; guard < 4; guard++) {
    let action: GameAction | null = null;
    if (player.state.phase === "item" && player.state.pendingItem?.choices.length) {
      const choices = player.state.pendingItem.choices;
      const rng = mulberry32(room.seed + room.round * 811 + player.seat * 97 + guard);
      action = { type: "CHOOSE_ITEM", id: choices[Math.floor(rng() * choices.length)] };
    } else if (player.state.phase === "augment" && player.state.pendingAugment?.choices.length) {
      const choices = player.state.pendingAugment.choices;
      const rng = mulberry32(room.seed + room.round * 1429 + player.seat * 131 + guard);
      action = { type: "CHOOSE_AUGMENT", id: choices[Math.floor(rng() * choices.length)] };
    }
    if (!action) return;
    applyPlayerAction(room, player, action);
  }
}

const allowedActions = new Set(["BUY_UNIT", "REROLL", "TOGGLE_LOCK", "BUY_XP", "MOVE_UNIT", "SELL_UNIT", "EQUIP_ITEM", "UNEQUIP_ITEM", "CHOOSE_AUGMENT", "CHOOSE_ITEM", "SET_COMBAT_SPEED"]);

function playerForWs(ws: WebSocket): { room: Room; player: ClientPlayer } | null {
  for (const room of rooms.values()) {
    for (const player of room.players) if (player?.ws === ws) return { room, player };
  }
  return null;
}

const wss = new WebSocketServer({ host: "0.0.0.0", port: PORT });
console.log(`[pvp] websocket server listening on 0.0.0.0:${PORT}`);

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (room.phase !== "planning" || room.resolving || !room.planningDeadline || now < room.planningDeadline) continue;
    for (const player of room.players) {
      if (!player) continue;
      autoResolveRewards(room, player);
      if (player.ready || player.state.phase !== "planning") continue;
      player.ready = true;
      pushLog(player.state, "准备倒计时结束：已自动准备。若未上阵棋子，本回合将按空阵判负。");
    }
    beginCombatIfReady(room);
    broadcast(room);
  }
}, 1000);

wss.on("connection", (ws) => {
  send(ws, { type: "hello", version: 1 });
  ws.on("message", (raw) => {
    let message: any;
    try { message = JSON.parse(String(raw)); } catch { return; }
    const name = String(message.name ?? "无名指挥官").slice(0, 18) || "无名指挥官";
    if (message.type === "create") {
      createRoom(ws, name, message.poolGroups);
      return;
    }
    if (message.type === "join") {
      joinRoom(ws, String(message.code ?? ""), name);
      return;
    }
    const found = playerForWs(ws);
    if (!found) return;
    const { room, player } = found;
    if (message.type === "action" && message.action && allowedActions.has(message.action.type)) {
      if (["CHOOSE_AUGMENT", "CHOOSE_ITEM"].includes(message.action.type) || player.state.phase === "planning" || message.action.type === "SET_COMBAT_SPEED") {
        applyPlayerAction(room, player, message.action as GameAction);
        broadcast(room);
      }
      return;
    }
    if (message.type === "skip") {
      if (room.phase !== "combat") return;
      player.skip = true;
      const opponent = room.players[player.seat === 0 ? 1 : 0];
      if (opponent?.skip && hostCombatResult(room)) {
        // The scheduled timer is idempotent; resolving early is safe because
        // resolveCombat refuses to run outside the combat phase.
        resolveCombat(room, hostCombatResult(room)!);
      } else {
        broadcast(room);
      }
      return;
    }
    if (message.type === "ready") {
      if (room.phase !== "planning" || player.state.phase !== "planning") return;
      if (!boardCount(player.state.players[0])) {
        pushLog(player.state, "至少上阵 1 个棋子才能开始战斗。");
        broadcast(room);
        return;
      }
      player.ready = true;
      pushLog(player.state, "你已准备完毕，等待对手。");
      beginCombatIfReady(room);
      broadcast(room);
    }
  });
  ws.on("close", () => {
    const found = playerForWs(ws);
    if (!found) return;
    const { room, player } = found;
    player.connected = false;
    if (room.phase !== "gameover") {
      const opponent = room.players[player.seat === 0 ? 1 : 0];
      if (opponent) pushLog(opponent.state, "对手已断开连接。你可以等待其重连，或返回大厅重新匹配。");
    }
    if (room.players.every((p) => !p || !p.connected)) rooms.delete(room.code);
    else broadcast(room);
  });
});
