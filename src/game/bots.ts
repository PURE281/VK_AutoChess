import type { BotPersonality, Champion, LocationRef, PlayerState, UnitInstance } from "../types";
import { primaryElement } from "../data";
import { BENCH_SIZE, SHOP_ODDS, XP_TO_NEXT } from "./definitions";
import { addUnitToBench, allUnitRefs, boardCount, boardKey, createEmptyPlayer, deployLimit, firstEmptyBench, makeUnit, sellValue, tryCombine } from "./roster";
import { clamp, pickOne, shuffle, weightedPick } from "./random";
import { chooseBalancedAugments } from "./balance";

const BOT_NAMES = [
  "霜月旅人", "亚斯格特老兵", "幻影棋手", "密米尔之声", "黄昏观测者", "彩虹桥守卫", "世界树根系",
  "英灵候补", "月读信徒", "巨人猎手", "精灵巡林客", "深海祭司",
];

export function createBots(count: number, rng: () => number): PlayerState[] {
  const personalities: BotPersonality[] = ["econ", "aggressive", "vertical", "balanced"];
  const names = shuffle(rng, BOT_NAMES);
  const bots: PlayerState[] = [];
  for (let i = 0; i < count; i++) {
    const bot = createEmptyPlayer(i + 1, names[i % names.length], false);
    bot.personality = personalities[i % personalities.length];
    bot.traitPreference = 1 + Math.floor(rng() * 8);
    bot.gold = 10 + Math.floor(rng() * 4);
    bot.botPowerBonus = 0.94 + rng() * 0.08;
    bots.push(bot);
  }
  return bots;
}

function drawChampionId(player: PlayerState, pool: Record<number, number>, roster: Champion[], rng: () => number): number | null {
  const odds = SHOP_ODDS[Math.min(9, player.level)] ?? SHOP_ODDS[1];
  const costEntries = odds
    .map((weight, index) => [index + 1, weight] as [number, number])
    .filter(([cost]) => roster.some((c) => c.cost === cost && (pool[c.id] ?? 0) > 0));
  const cost = weightedPick(rng, costEntries);
  if (!cost) return null;
  const candidates = roster
    .filter((c) => c.cost === cost && (pool[c.id] ?? 0) > 0)
    .map((c) => [c.id, 1] as [number, number]);
  return weightedPick(rng, candidates);
}

function unitValue(unit: UnitInstance, champion: Champion | undefined, preference?: number): number {
  if (!champion) return 0;
  let value = champion.cost * Math.pow(2.25, unit.star - 1);
  if (preference && champion.race === preference) value *= 1.28;
  if (unit.star >= 2) value *= 1.18;
  return value;
}

function botShouldBuy(bot: PlayerState, champion: Champion, rng: () => number): boolean {
  if (!bot.personality) return true;
  if (bot.personality === "vertical") return champion.race === bot.traitPreference || champion.cost >= 3 || rng() < 0.2;
  if (bot.personality === "aggressive") return champion.cost <= 3 || rng() < 0.45;
  if (bot.personality === "econ") return champion.cost >= 2 || rng() < 0.35;
  return true;
}

function teamSynergyScore(units: UnitInstance[], champions: Map<number, Champion>): number {
  const races = new Map<number, number>();
  const roles = new Map<string, number>();
  const elements = new Map<number, number>();
  const seen = new Set<number>();
  for (const unit of units) {
    if (seen.has(unit.championId)) continue;
    const champion = champions.get(unit.championId);
    if (!champion) continue;
    seen.add(unit.championId);
    races.set(champion.race, (races.get(champion.race) ?? 0) + 1);
    roles.set(champion.role, (roles.get(champion.role) ?? 0) + 1);
    const element = primaryElement(champion.elementMask);
    if (element !== 1 && element !== 64) elements.set(element, (elements.get(element) ?? 0) + 1);
  }
  let score = 0;
  for (const count of races.values()) score += count >= 4 ? 34 : count >= 2 ? 14 : 0;
  for (const count of roles.values()) score += count >= 4 ? 30 : count >= 2 ? 13 : 0;
  for (const count of elements.values()) score += count >= 4 ? 24 : count >= 2 ? 9 : 0;
  return score;
}

function deployBestUnits(bot: PlayerState, champions: Map<number, Champion>): void {
  const all = allUnitRefs(bot).map(({ unit }) => unit);
  const unique = new Map<string, UnitInstance>();
  for (const unit of all) unique.set(unit.uid, unit);
  const units = Array.from(unique.values()).sort((a, b) => {
    const ca = champions.get(a.championId);
    const cb = champions.get(b.championId);
    return unitValue(b, cb, bot.traitPreference) - unitValue(a, ca, bot.traitPreference);
  });
  const count = Math.min(deployLimit(bot), units.length);
  const chosen: UnitInstance[] = [];
  const remaining = units.slice();
  while (chosen.length < count && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const base = unitValue(candidate, champions.get(candidate.championId), bot.traitPreference);
      const synergy = teamSynergyScore([...chosen, candidate], champions) - teamSynergyScore(chosen, champions);
      const score = base + synergy * (bot.personality === "vertical" ? 1.35 : 0.85);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    chosen.push(remaining.splice(bestIndex, 1)[0]);
  }
  const chosenIds = new Set(chosen.map((unit) => unit.uid));
  const benchUnits = units.filter((unit) => !chosenIds.has(unit.uid));
  bot.board = {};
  bot.bench = Array.from({ length: BENCH_SIZE }, () => null);

  const front = chosen.filter((u) => {
    const role = champions.get(u.championId)?.role;
    return role === "warden" || role === "templar" || role === "berserker";
  });
  const middle = chosen.filter((u) => champions.get(u.championId)?.role === "assassin");
  const back = chosen.filter((u) => !front.includes(u) && !middle.includes(u));

  let index = 0;
  const place = (unit: UnitInstance, x: number, y: number) => {
    bot.board[boardKey(Math.max(0, Math.min(7, x)), y)] = unit;
  };
  for (const unit of front) place(unit, index++ % 8, 0);
  index = 0;
  for (const unit of middle) place(unit, index++ % 8, 1);
  index = 0;
  for (const unit of back) place(unit, index++ % 8, back.length > 3 ? 3 : 2);
  benchUnits.forEach((unit, i) => {
    if (i < BENCH_SIZE) bot.bench[i] = unit;
  });
}

export function runBotTurn(
  bot: PlayerState,
  pool: Record<number, number>,
  roster: Champion[],
  champions: Map<number, Champion>,
  rng: () => number,
  round: number,
): void {
  if (!bot.alive) return;
  const personality = bot.personality ?? "balanced";
  const desiredLevelRound = personality === "aggressive" ? [3, 5, 7, 9, 11, 13, 15] : personality === "econ" ? [5, 8, 11, 14, 17, 20, 23] : [4, 7, 10, 13, 16, 19, 22];
  if (bot.level < 9 && round >= desiredLevelRound[Math.max(0, bot.level - 2)] && bot.gold >= (personality === "econ" ? 28 : 14)) {
    while (bot.gold >= 4 && bot.level < 9) {
      bot.gold -= 4;
      bot.xp += 4;
      const need = XP_TO_NEXT[bot.level] ?? 999;
      if (bot.xp < need) break;
      bot.xp -= need;
      bot.level += 1;
    }
  }

  const reserve = round <= 2 ? 0 : personality === "econ" ? Math.min(50, 6 + round) : personality === "aggressive" ? 0 : 6;
  let attempts = personality === "aggressive" ? 7 : personality === "vertical" ? 5 : 4;
  while (attempts-- > 0 && bot.gold - reserve >= 1) {
    const cid = drawChampionId(bot, pool, roster, rng);
    if (!cid) break;
    const champion = champions.get(cid);
    if (!champion) continue;
    const wants = botShouldBuy(bot, champion, rng) && bot.gold - reserve >= champion.cost;
    const benchSpace = firstEmptyBench(bot) >= 0 || allUnitRefs(bot).some(({ unit }) => unit.championId === cid && unit.star < 3);
    if (wants && benchSpace) {
      bot.gold -= champion.cost;
      pool[cid] = Math.max(0, (pool[cid] ?? 0) - 1);
      addUnitToBench(bot, makeUnit(cid));
    }
  }

  // Sell obvious bench overflow; bots do not hoard dead copies forever.
  if (firstEmptyBench(bot) < 0) {
    const benchEntries = bot.bench
      .map((unit, index) => ({ unit, index }))
      .filter((entry): entry is { unit: UnitInstance; index: number } => Boolean(entry.unit))
      .sort((a, b) => unitValue(a.unit, champions.get(a.unit.championId), bot.traitPreference) - unitValue(b.unit, champions.get(b.unit.championId), bot.traitPreference));
    const worst = benchEntries[0];
    if (worst && boardCount(bot) >= Math.max(1, deployLimit(bot) - 1)) {
      const champion = champions.get(worst.unit.championId);
      if (champion) bot.gold += sellValue(champion, worst.unit.star);
      bot.bench[worst.index] = null;
    }
  }

  deployBestUnits(bot, champions);

  // Bots receive augments on the same cadence. Combat augments are represented as a small team bonus;
  // economic augments alter how freely they spend in later rounds.
  const augmentCount = [3, 8, 13].filter((r) => round >= r).length;
  while (bot.augments.length < augmentCount) {
    const augment = chooseBalancedAugments(rng, round, bot.augments, bot.lossStreak, 1, bot.winStreak)[0];
    if (!augment) break;
    bot.augments.push(augment.id);
    if (["healthy_body", "swift_tactics", "critical_lesson", "holy_word", "crafted_barrier", "elemental_attune", "mana_spring", "executioner", "last_stand", "extra_deploy"].includes(augment.id)) {
      bot.botPowerBonus += 0.035;
    } else {
      bot.gold += 4;
    }
  }

  // Smooth difficulty curve: strong bots stay threatening but not mathematically perfect.
  bot.botPowerBonus = clamp(bot.botPowerBonus + (rng() - 0.48) * 0.006, 0.9, 1.18);
  for (const { unit } of allUnitRefs(bot)) tryCombine(bot, unit.championId, unit.star);
}

export function teamPower(player: PlayerState, champions: Map<number, Champion>): number {
  let power = 0;
  for (const unit of Object.values(player.board)) {
    const champion = champions.get(unit.championId);
    if (!champion) continue;
    const starMult = [1, 1.8, 3.1][unit.star - 1] ?? 1;
    power += (55 + champion.cost * 34) * starMult * (1 + unit.items.length * 0.12);
  }
  power *= player.botPowerBonus || 1;
  power *= 1 + Math.max(0, player.level - 2) * 0.025;
  return power;
}

export function resolveBotBattles(players: PlayerState[], champions: Map<number, Champion>, rng: () => number, round: number, excludeBotId = -1): string[] {
  const messages: string[] = [];
  const bots = shuffle(rng, players.filter((p) => !p.isHuman && p.alive && p.id !== excludeBotId));
  const pairs: Array<[PlayerState, PlayerState | null]> = [];
  for (let i = 0; i < bots.length; i += 2) pairs.push([bots[i], bots[i + 1] ?? null]);
  for (const [a, b] of pairs) {
    const pa = teamPower(a, champions) * (0.86 + rng() * 0.3);
    const pb = b ? teamPower(b, champions) * (0.86 + rng() * 0.3) : pa * (0.72 + rng() * 0.12);
    const aWins = pa / (pa + pb) > rng();
    const winner = aWins ? a : b;
    const loser = aWins ? b : a;
    if (winner) {
      winner.winStreak += 1;
      winner.lossStreak = 0;
    }
    if (loser) {
      loser.lossStreak += 1;
      loser.winStreak = 0;
      const margin = Math.abs(pa - pb) / Math.max(pa, pb, 1);
      const damage = Math.round(4 + round * 0.75 + margin * 9 + rng() * 3);
      loser.hp = Math.max(0, loser.hp - damage);
      if (loser.hp <= 0 && loser.alive) {
        loser.alive = false;
        loser.eliminatedRound = round;
        messages.push(`${loser.name} 在第 ${round} 回合被淘汰`);
      }
    }
  }
  return messages;
}

export function chooseHumanOpponent(players: PlayerState[], rng: () => number): PlayerState | null {
  const human = players.find((p) => p.isHuman);
  const candidates = players.filter((p) => !p.isHuman && p.alive && p.id !== human?.lastOpponentId);
  if (!candidates.length) return players.find((p) => !p.isHuman && p.alive) ?? null;
  return pickOne(rng, candidates);
}
