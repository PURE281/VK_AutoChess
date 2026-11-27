import type {
  ActiveCombat,
  Champion,
  GameMode,
  GameState,
  LocationRef,
  PlayerState,
  RoundType,
  UnitInstance,
} from "../types";
import type { DataStore } from "../data";
import { AUGMENTS, ITEMS, XP_TO_NEXT } from "./definitions";
import { chooseHumanOpponent, createBots, resolveBotBattles, runBotTurn } from "./bots";
import type { CombatEntry, CombatTeamInput } from "./combat";
import { simulateCombat } from "./combat";
import {
  addUnitToBench,
  boardCount,
  createEmptyPlayer,
  createPool,
  deployLimit,
  getUnitAt,
  makeUnit,
  moveUnit,
  refundPool,
  removeUnit,
  resetUid,
  rollShop,
  sellValue,
} from "./roster";
import { combatTraitLevels } from "./synergies";
import { mulberry32, pickOne, shuffle } from "./random";
import { chooseBalancedAugments, chooseBalancedItems, lossStreakGoldBonus, winStreakGoldBonus } from "./balance";

export type GameAction =
  | { type: "NEW_GAME"; seed?: number; mode?: GameMode }
  | { type: "BUY_UNIT"; slot: number }
  | { type: "REROLL" }
  | { type: "TOGGLE_LOCK" }
  | { type: "BUY_XP" }
  | { type: "MOVE_UNIT"; from: LocationRef; to: LocationRef }
  | { type: "SELL_UNIT"; loc: LocationRef }
  | { type: "START_COMBAT" }
  | { type: "COMBAT_FINISHED" }
  | { type: "CHOOSE_AUGMENT"; id: string }
  | { type: "CHOOSE_ITEM"; id: string }
  | { type: "EQUIP_ITEM"; itemIndex: number; loc: LocationRef }
  | { type: "UNEQUIP_ITEM"; loc: LocationRef; itemIndex: number }
  | { type: "SET_COMBAT_SPEED"; speed: number }
  | { type: "ADD_LOG"; message: string };

export interface EngineContext {
  store: DataStore;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function human(state: GameState): PlayerState {
  return state.players[0];
}

function pushLog(state: GameState, message: string): void {
  state.log.unshift(message);
  state.log = state.log.slice(0, 90);
}

export function roundType(round: number, mode: GameMode = "pve"): RoundType {
  return mode === "trial" || round <= 2 || round % 5 === 0 ? "pve" : "pvp";
}

function incomeFor(player: PlayerState): number {
  const interestCap = player.augments.includes("gold_flow") ? 7 : 5;
  const interest = Math.min(interestCap, Math.floor(player.gold / 10));
  const streak = winStreakGoldBonus(player.winStreak) + lossStreakGoldBonus(player.lossStreak);
  return 5 + interest + streak + (player.augments.includes("gold_flow") ? 1 : 0);
}

function returnShopToPool(state: GameState, player: PlayerState): void {
  for (const slot of player.shop) {
    if (slot.championId && !slot.sold) refundPool(state.pool, slot.championId, 1);
  }
}

function activeChampions(store: DataStore, state: GameState): Champion[] {
  return state.activeRoster.map((id) => store.champions.get(id)).filter((c): c is Champion => Boolean(c));
}

export function createInitialState(store: DataStore, seed = Date.now() % 1000000000, mode: GameMode = "pve"): GameState {
  resetUid(seed);
  const rng = mulberry32(seed);
  const active = mode === "chaos"
    ? store.dataset.characters.filter((c) => c.assets.hasIcon)
    : store.season1.length >= 60 ? store.season1 : store.dataset.characters.filter((c) => c.season1);
  const activeRoster = active.map((c) => c.id);
  const state: GameState = {
    phase: "planning",
    mode,
    seed,
    round: 1,
    players: [createEmptyPlayer(0, "你", true)],
    pool: createPool(active),
    activeRoster,
    combat: null,
    pendingAugment: null,
    pendingItem: null,
    log: [],
    combatSpeed: 1,
    roundType: roundType(1, mode),
    rngCursor: 1,
  };
  if (mode !== "trial") {
    state.players.push(...createBots(7, rng));
    // Let bots make their first purchase so round-one boards are not empty if they appear later.
    for (const bot of state.players.slice(1)) runBotTurn(bot, state.pool, active, store.champions, rng, 1);
  }
  human(state).shop = rollShop(human(state), state.pool, active, rng);
  pushLog(state, mode === "trial" ? "世界树试炼开启。在 20 轮连续试炼中活下来。第 1 回合：整备阶段。" : mode === "chaos" ? "全英灵混战开启：985 名角色进入混沌卡池，与 7 名 AI 指挥官争夺胜利。第 1 回合：整备阶段。" : "单机棋境开启：与 7 名 AI 指挥官争夺最终胜利。第 1 回合：整备阶段。");
  return state;
}

function rerollCost(player: PlayerState): number {
  return player.augments.includes("cheap_refresh") ? 1 : 2;
}

function levelUp(player: PlayerState, amount: number): string[] {
  const messages: string[] = [];
  player.xp += amount;
  while (player.level < 9) {
    const need = XP_TO_NEXT[player.level] ?? 999;
    if (player.xp < need) break;
    player.xp -= need;
    player.level += 1;
    messages.push(`等级提升到 ${player.level}，上阵上限 ${deployLimit(player)}`);
  }
  return messages;
}

function entriesFromPlayer(player: PlayerState, champions: Map<number, Champion>, side: "player" | "enemy"): CombatEntry[] {
  const entries: CombatEntry[] = [];
  for (const [key, unit] of Object.entries(player.board)) {
    const [x, localY] = key.split(",").map(Number);
    const champion = champions.get(unit.championId);
    if (!champion) continue;
    entries.push({
      unit,
      champion,
      x,
      y: side === "player" ? 4 + localY : 3 - localY,
    });
  }
  return entries;
}

function inputFromPlayer(player: PlayerState, champions: Map<number, Champion>, side: "player" | "enemy", powerBonus = 1): CombatTeamInput {
  return {
    entries: entriesFromPlayer(player, champions, side),
    traits: combatTraitLevels(player, champions),
    augments: player.augments,
    powerBonus,
    lowHp: player.isHuman && player.hp <= 35,
  };
}

function makePveInput(store: DataStore, roster: Champion[], round: number, rng: () => number, trialMode = false): CombatTeamInput {
  const thematic = roster.filter((c) => [6, 7].includes(c.race));
  const fallback = roster.filter((c) => c.cost <= Math.min(5, 1 + Math.ceil(round / 4)));
  const candidates = thematic.length >= 8 ? thematic : fallback;
  const count = Math.min(7, 1 + Math.floor((round + 1) / 4));
  const entries: CombatEntry[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    const pool = candidates.filter((c) => !used.has(c.id) && c.cost <= Math.min(5, 1 + Math.ceil(round / 5)));
    const champion = pool.length ? pickOne(rng, pool) : pickOne(rng, candidates);
    used.add(champion.id);
    const star = round >= 15 && i < 2 ? 3 : round >= 7 && i < 2 ? 2 : 1;
    const itemCount = round >= 10 && i < 2 ? 1 : 0;
    const unit: UnitInstance = makeUnit(champion.id, star, shuffle(rng, ITEMS.filter((item) => item.id !== "hero_duplicator")).slice(0, itemCount).map((item) => item.id));
    entries.push({
      unit,
      champion,
      x: 1 + (i * 1.35) % 6,
      y: 3 - (i % 3),
    });
  }
  return {
    entries,
    traits: { races: {}, roles: {}, elements: {} },
    augments: [],
    powerBonus: trialMode ? 0.69 + round * 0.041 : 0.66 + round * 0.025,
  };
}

function beginCombat(state: GameState, store: DataStore): void {
  const me = human(state);
  if (!boardCount(me)) {
    pushLog(state, "至少上阵 1 个棋子才能开始战斗。");
    return;
  }
  const rng = mulberry32(state.seed + state.round * 7919);
  const roster = activeChampions(store, state);
  const type = state.roundType;
  let opponentId = -1;
  let opponentName = "世界树试炼";
  let enemyInput: CombatTeamInput;
  if (type === "pve") {
    enemyInput = makePveInput(store, roster, state.round, rng, state.mode === "trial");
  } else {
    const opponent = chooseHumanOpponent(state.players, rng);
    if (!opponent) {
      pushLog(state, "没有可挑战的对手。");
      return;
    }
    opponentId = opponent.id;
    opponentName = opponent.name;
    me.lastOpponentId = opponent.id;
    enemyInput = inputFromPlayer(opponent, store.champions, "enemy", opponent.botPowerBonus);
  }
  const playerInput = inputFromPlayer(me, store.champions, "player", 1);
  const result = simulateCombat(playerInput, enemyInput, state.seed + state.round * 131071 + (type === "pve" ? 17 : 0));
  const combat: ActiveCombat = {
    round: state.round,
    roundType: type,
    opponentId,
    opponentName,
    result,
    startedAt: performance.now(),
  };
  state.combat = combat;
  state.phase = "combat";
  pushLog(state, `第 ${state.round} 回合战斗开始：${type === "pve" ? "世界树试炼" : `对阵 ${opponentName}`}`);
}

function playerDamageFor(round: number, unitsLeft: number, survivingPct: number): number {
  return Math.max(1, Math.round(2 + round * 0.48 + unitsLeft * 1.35 + survivingPct * 2.2));
}

function applyPostCombatEconomy(state: GameState, store: DataStore): void {
  const rng = mulberry32(state.seed + state.round * 31337 + 77);
  const messages = resolveBotBattles(state.players, store.champions, rng, state.round, state.combat?.opponentId);
  for (const message of messages) pushLog(state, message);
  for (const player of state.players) {
    if (!player.alive) continue;
    player.gold += incomeFor(player);
  }
  const roster = activeChampions(store, state);
  for (const bot of state.players.slice(1)) {
    if (bot.alive) runBotTurn(bot, state.pool, roster, store.champions, rng, state.round + 1);
  }
}

function applyImmediateAugment(state: GameState, player: PlayerState, augmentId: string): void {
  if (augmentId === "golden_injection") player.gold += 12;
  if (augmentId === "fast_training") {
    for (const msg of levelUp(player, 8)) pushLog(state, msg);
  }
  if (augmentId === "oracle_refresh") player.freeRerolls += 1;
  if (augmentId === "duplicator") {
    player.itemInventory.push("hero_duplicator");
    pushLog(state, "获得消耗品「英雄复制器」：点击它，再点击任意已拥有棋子即可复制。");
  }
}

function finishCombat(state: GameState, store: DataStore): void {
  const combat = state.combat;
  if (!combat) return;
  const me = human(state);
  const won = combat.result.winner === "player";
  const draw = combat.result.winner === "draw";
  const opponent = combat.opponentId >= 0 ? state.players.find((p) => p.id === combat.opponentId) : null;

  if (won) {
    me.winStreak += 1;
    me.lossStreak = 0;
    if (opponent) {
      opponent.lossStreak += 1;
      opponent.winStreak = 0;
      const retaliation = playerDamageFor(combat.round, combat.result.playerUnitsLeft, combat.result.survivingPlayer);
      opponent.hp = Math.max(0, opponent.hp - retaliation);
      if (opponent.hp <= 0 && opponent.alive) {
        opponent.alive = false;
        opponent.eliminatedRound = combat.round;
        pushLog(state, `${opponent.name} 被你在第 ${combat.round} 回合淘汰。`);
      }
    }
    pushLog(state, `第 ${combat.round} 回合胜利：剩余 ${combat.result.playerUnitsLeft} 个友军。`);
  } else if (!draw) {
    me.lossStreak += 1;
    me.winStreak = 0;
    const damage = Math.max(1, Math.round(playerDamageFor(combat.round, combat.result.enemyUnitsLeft, combat.result.survivingEnemy) * (combat.roundType === "pve" ? 0.45 : 1)));
    me.hp = Math.max(0, me.hp - damage);
    pushLog(state, `第 ${combat.round} 回合战败，受到 ${damage} 点伤害。`);
    if (opponent) {
      opponent.winStreak += 1;
      opponent.lossStreak = 0;
    }
  } else {
    const damage = Math.max(1, Math.round(playerDamageFor(combat.round, combat.result.enemyUnitsLeft, combat.result.survivingEnemy) * 0.55));
    me.hp = Math.max(0, me.hp - damage);
    pushLog(state, `第 ${combat.round} 回合超时鏖战，受到 ${damage} 点伤害。连胜/连败不受影响。`);
  }
  if (won && combat.roundType === "pvp") {
    if (me.augments.includes("war_treasury")) me.gold += 2;
    const humanRaceLevel = combatTraitLevels(me, store.champions).races[2] ?? 0;
    if (humanRaceLevel > 0) me.gold += humanRaceLevel;
  }

  applyPostCombatEconomy(state, store);
  if (!won && !draw && me.lossStreak >= 2) {
    pushLog(state, `连败追赶加成：本回合连败补贴 +${lossStreakGoldBonus(me.lossStreak)} 金币，后续神器/符文奖励品质提升。`);
  }

  if (me.hp <= 0) {
    me.alive = false;
    me.eliminatedRound = combat.round;
    state.phase = "gameover";
    state.gameResult = "defeat";
    pushLog(state, "你的英灵殿之旅到此结束。");
    return;
  }
  const completedRound = combat.round;
  if (state.mode === "trial" && completedRound >= 20) {
    state.phase = "gameover";
    state.gameResult = "victory";
    pushLog(state, "你完成了 20 轮世界树试炼！");
    return;
  }
  if (state.mode !== "trial") {
    const enemiesAlive = state.players.some((p) => !p.isHuman && p.alive);
    if (!enemiesAlive) {
      state.phase = "gameover";
      state.gameResult = "victory";
      pushLog(state, "所有对手都被淘汰。你赢得了女武神棋境！");
      return;
    }
  }

  state.round = completedRound + 1;
  state.roundType = roundType(state.round, state.mode);
  state.combat = null;

  const augmentRound = (state.mode === "trial" ? [3, 8, 13, 18] : [3, 8, 13]).includes(completedRound);
  if (augmentRound) {
    const rng = mulberry32(state.seed + completedRound * 424243);
    const choices = chooseBalancedAugments(rng, completedRound, me.augments, me.lossStreak, 3, me.winStreak).map((a) => a.id);
    if (choices.length) state.pendingAugment = { choices, round: completedRound };
  }

  const pveItemReward = combat.roundType === "pve" && won;
  const lossItemReward = !won && !draw && me.lossStreak >= 2;
  if (pveItemReward || lossItemReward) {
    const rng = mulberry32(state.seed + completedRound * 171717);
    state.pendingItem = { choices: chooseBalancedItems(rng, me.lossStreak, 3, me.winStreak).map((item) => item.id), round: completedRound };
  }

  if (state.pendingItem) {
    state.phase = "item";
    if (lossItemReward) {
      pushLog(state, state.pendingAugment
        ? `连败补给（${me.lossStreak} 连败）：选择 1 件高品质权重提升的神器，随后选择 1 个强化符文。`
        : `连败补给（${me.lossStreak} 连败）：选择 1 件高品质权重提升的神器。`);
    } else {
      pushLog(state, state.pendingAugment ? "试炼奖励：选择 1 件神器，随后选择 1 个强化符文。" : "试炼奖励：选择 1 件神器。");
    }
    return;
  }
  if (state.pendingAugment) {
    state.phase = "augment";
    pushLog(state, me.lossStreak >= 2 ? `神谕赐福降临：连败让你的高阶符文出现率提升（当前 ${me.lossStreak} 连败）。` : "神谕赐福降临：选择 1 个强化符文。");
    return;
  }

  state.phase = "planning";
  if (me.augments.includes("oracle_refresh")) me.freeRerolls = Math.max(me.freeRerolls, 1);
  if (!me.shopLocked) {
    returnShopToPool(state, me);
    const rng = mulberry32(state.seed + state.round * 2718);
    me.shop = rollShop(me, state.pool, activeChampions(store, state), rng);
  }
  pushLog(state, `第 ${state.round} 回合整备阶段开始。`);
}

function buyUnit(state: GameState, store: DataStore, slotIndex: number): void {
  const me = human(state);
  const slot = me.shop[slotIndex];
  if (!slot?.championId) return;
  const champion = store.champions.get(slot.championId);
  if (!champion) return;
  if (me.gold < champion.cost) {
    pushLog(state, "金币不足。");
    return;
  }
  const unit = makeUnit(champion.id);
  const added = addUnitToBench(me, unit);
  if (!added.ok) {
    pushLog(state, added.messages[0] ?? "无法购买。");
    return;
  }
  me.gold -= champion.cost;
  slot.sold = true;
  slot.championId = null;
  pushLog(state, `购入 ${champion.name}（${champion.cost} 费）。`);
  for (const message of added.messages) pushLog(state, `${champion.name} ${message}`);
}

function equipItem(state: GameState, store: DataStore, itemIndex: number, loc: LocationRef): void {
  const me = human(state);
  const itemId = me.itemInventory[itemIndex];
  if (!itemId) return;
  const unit = getUnitAt(me, loc);
  if (!unit) {
    pushLog(state, "请选择一个已拥有棋子来装备神器。");
    return;
  }
  if (itemId === "hero_duplicator") {
    const champion = store.champions.get(unit.championId);
    const copy = makeUnit(unit.championId, unit.star);
    const added = addUnitToBench(me, copy);
    if (!added.ok) {
      pushLog(state, `英雄复制器使用失败：${added.messages[0] ?? "备战席已满"}`);
      return;
    }
    me.itemInventory.splice(itemIndex, 1);
    pushLog(state, `英雄复制器复制了 ${champion?.name ?? unit.championId}（★${unit.star}），复制体已放入备战席。`);
    for (const message of added.messages) pushLog(state, `${champion?.name ?? "复制体"} ${message}`);
    return;
  }
  if (unit.items.length >= 2) {
    pushLog(state, "该棋子已经携带 2 件神器。");
    return;
  }
  me.itemInventory.splice(itemIndex, 1);
  unit.items.push(itemId);
  const item = ITEMS.find((it) => it.id === itemId);
  pushLog(state, `${item?.name ?? itemId} 已装备。`);
}

function reducerWithStore(state: GameState, action: GameAction, store: DataStore): GameState {
  if (action.type === "NEW_GAME") return createInitialState(store, action.seed, action.mode ?? state.mode);
  const next = clone(state);
  const me = human(next);
  next.rngCursor = (next.rngCursor ?? 0) + 1;
  const rng = mulberry32(next.seed + next.round * 977 + next.rngCursor * 314159 + next.players.reduce((s, p) => s + p.gold * 13 + p.level * 31, 0));

  switch (action.type) {
    case "BUY_UNIT":
      if (next.phase === "planning") buyUnit(next, store, action.slot);
      break;
    case "REROLL": {
      if (next.phase !== "planning") break;
      const free = me.freeRerolls > 0;
      const cost = free ? 0 : rerollCost(me);
      if (me.gold < cost) {
        pushLog(next, "金币不足，无法刷新。");
        break;
      }
      me.gold -= cost;
      if (free) me.freeRerolls -= 1;
      returnShopToPool(next, me);
      me.shop = rollShop(me, next.pool, activeChampions(store, next), rng);
      pushLog(next, free ? "使用免费刷新。" : `花费 ${cost} 金币刷新商店。`);
      break;
    }
    case "TOGGLE_LOCK":
      if (next.phase === "planning") {
        me.shopLocked = !me.shopLocked;
        pushLog(next, me.shopLocked ? "商店已锁定。" : "商店已解锁。");
      }
      break;
    case "BUY_XP": {
      if (next.phase !== "planning") break;
      if (me.gold < 4) {
        pushLog(next, "金币不足，无法购买经验。");
        break;
      }
      me.gold -= 4;
      const amount = 4 + (me.augments.includes("studious") ? 2 : 0);
      const messages = levelUp(me, amount);
      pushLog(next, `获得 ${amount} 点经验。`);
      for (const message of messages) pushLog(next, message);
      break;
    }
    case "MOVE_UNIT": {
      if (next.phase !== "planning") break;
      const result = moveUnit(me, action.from, action.to);
      if (!result.ok && result.message) pushLog(next, result.message);
      break;
    }
    case "SELL_UNIT": {
      if (next.phase !== "planning") break;
      const unit = removeUnit(me, action.loc);
      if (!unit) break;
      const champion = store.champions.get(unit.championId);
      if (!champion) break;
      const value = sellValue(champion, unit.star);
      me.gold += value;
      refundPool(next.pool, unit.championId, Math.pow(3, unit.star - 1));
      pushLog(next, `出售 ${champion.name}，获得 ${value} 金币。`);
      break;
    }
    case "START_COMBAT":
      if (next.phase === "planning") beginCombat(next, store);
      break;
    case "COMBAT_FINISHED":
      if (next.phase === "combat") finishCombat(next, store);
      break;
    case "CHOOSE_AUGMENT": {
      if (next.phase !== "augment" || !next.pendingAugment?.choices.includes(action.id)) break;
      me.augments.push(action.id);
      const augment = AUGMENTS.find((a) => a.id === action.id);
      pushLog(next, `获得强化符文「${augment?.name ?? action.id}」。`);
      applyImmediateAugment(next, me, action.id);
      next.pendingAugment = null;
      if (next.pendingItem) {
        next.phase = "item";
        break;
      }
      next.phase = "planning";
      if (me.augments.includes("oracle_refresh")) me.freeRerolls = Math.max(me.freeRerolls, 1);
      if (!me.shopLocked) {
        returnShopToPool(next, me);
        me.shop = rollShop(me, next.pool, activeChampions(store, next), rng);
      }
      break;
    }
    case "CHOOSE_ITEM": {
      if (next.phase !== "item" || !next.pendingItem?.choices.includes(action.id)) break;
      me.itemInventory.push(action.id);
      const item = ITEMS.find((it) => it.id === action.id);
      pushLog(next, `获得神器「${item?.name ?? action.id}」。点击神器后再点击棋子即可装备或使用。`);
      next.pendingItem = null;
      if (next.pendingAugment) {
        next.phase = "augment";
        break;
      }
      next.phase = "planning";
      if (me.augments.includes("oracle_refresh")) me.freeRerolls = Math.max(me.freeRerolls, 1);
      if (!me.shopLocked) {
        returnShopToPool(next, me);
        me.shop = rollShop(me, next.pool, activeChampions(store, next), rng);
      }
      break;
    }
    case "EQUIP_ITEM":
      if (next.phase === "planning") equipItem(next, store, action.itemIndex, action.loc);
      break;
    case "UNEQUIP_ITEM": {
      if (next.phase !== "planning") break;
      const unit = getUnitAt(me, action.loc);
      if (!unit || !unit.items[action.itemIndex]) break;
      const [item] = unit.items.splice(action.itemIndex, 1);
      me.itemInventory.push(item);
      pushLog(next, "神器已卸下。");
      break;
    }
    case "SET_COMBAT_SPEED":
      next.combatSpeed = action.speed;
      break;
    case "ADD_LOG":
      pushLog(next, action.message);
      break;
    default:
      break;
  }
  return next;
}

export function createGameReducer(store: DataStore) {
  return (state: GameState, action: GameAction) => reducerWithStore(state, action, store);
}
