import type { Champion, LocationRef, PlayerState, ShopSlot, UnitInstance } from "../types";
import { BENCH_SIZE, BOARD_COLS, BOARD_ROWS, POOL_COPIES, SHOP_ODDS } from "./definitions";
import { weightedPick } from "./random";

let nextUid = 1;
export function resetUid(seed = 1): void {
  nextUid = seed * 100000 + 1;
}

export function makeUnit(championId: number, star = 1, items: string[] = []): UnitInstance {
  return { uid: `u${nextUid++}`, championId, star, items: items.slice() };
}

export function boardKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function sameLocation(a: LocationRef, b: LocationRef): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bench" && b.type === "bench") return a.index === b.index;
  if (a.type === "board" && b.type === "board") return a.x === b.x && a.y === b.y;
  return false;
}

export function getUnitAt(player: PlayerState, loc: LocationRef): UnitInstance | null {
  if (loc.type === "bench") return player.bench[loc.index] ?? null;
  return player.board[boardKey(loc.x, loc.y)] ?? null;
}

export function setUnitAt(player: PlayerState, loc: LocationRef, unit: UnitInstance | null): void {
  if (loc.type === "bench") {
    player.bench[loc.index] = unit;
  } else {
    const key = boardKey(loc.x, loc.y);
    if (unit) player.board[key] = unit;
    else delete player.board[key];
  }
}

export function allUnitRefs(player: PlayerState): Array<{ loc: LocationRef; unit: UnitInstance }> {
  const refs: Array<{ loc: LocationRef; unit: UnitInstance }> = [];
  for (const [key, unit] of Object.entries(player.board)) {
    const [x, y] = key.split(",").map(Number);
    refs.push({ loc: { type: "board", x, y }, unit });
  }
  player.bench.forEach((unit, index) => {
    if (unit) refs.push({ loc: { type: "bench", index }, unit });
  });
  return refs;
}

export function boardUnits(player: PlayerState): UnitInstance[] {
  return Object.values(player.board);
}

export function boardCount(player: PlayerState): number {
  return Object.keys(player.board).length;
}

export function deployLimit(player: PlayerState): number {
  return player.level + (player.augments.includes("extra_deploy") ? 1 : 0);
}

export function firstEmptyBench(player: PlayerState): number {
  return player.bench.findIndex((unit) => unit == null);
}

export function firstEmptyBoard(player: PlayerState): LocationRef | null {
  // Front rows fill first so a brand-new copy is at least visually useful when auto-deployed.
  for (let y = 0; y < BOARD_ROWS; y++) {
    for (let x = 0; x < BOARD_COLS; x++) {
      if (!player.board[boardKey(x, y)]) return { type: "board", x, y };
    }
  }
  return null;
}

export function createPool(activeRoster: Champion[]): Record<number, number> {
  const pool: Record<number, number> = {};
  for (const champion of activeRoster) {
    pool[champion.id] = POOL_COPIES[champion.cost] ?? 12;
  }
  return pool;
}

export function rollShop(
  player: PlayerState,
  pool: Record<number, number>,
  roster: Champion[],
  rng: () => number,
): ShopSlot[] {
  const odds = SHOP_ODDS[Math.min(9, Math.max(1, player.level))] ?? SHOP_ODDS[1];
  const slots: ShopSlot[] = [];
  for (let slot = 0; slot < 5; slot++) {
    const costEntries = odds
      .map((weight, index) => [index + 1, weight] as [number, number])
      .filter(([cost]) => roster.some((c) => c.cost === cost && (pool[c.id] ?? 0) > 0));
    const cost = weightedPick(rng, costEntries);
    if (!cost) {
      slots.push({ championId: null });
      continue;
    }
    const candidates = roster
      .filter((c) => c.cost === cost && (pool[c.id] ?? 0) > 0)
      .map((c) => [c.id, 1] as [number, number]);
    const championId = weightedPick(rng, candidates);
    if (championId && (pool[championId] ?? 0) > 0) {
      pool[championId] -= 1;
      slots.push({ championId });
    } else {
      slots.push({ championId: null });
    }
  }
  return slots;
}

export function refundPool(pool: Record<number, number>, championId: number, amount = 1): void {
  pool[championId] = (pool[championId] ?? 0) + amount;
}

export function sellValue(champion: Champion, star: number): number {
  const copies = Math.pow(3, star - 1);
  // High-cost units keep a tiny deprecation tax to prevent zero-risk cycling.
  return Math.max(1, Math.floor(champion.cost * copies * (star === 1 ? 1 : 0.92)));
}

export function collectCopies(player: PlayerState, championId: number, star: number): Array<{ loc: LocationRef; unit: UnitInstance }> {
  return allUnitRefs(player).filter(({ unit }) => unit.championId === championId && unit.star === star);
}

export function starProgress(player: PlayerState, championId: number): { baseCopies: number; highestStar: number; nextStar: number | null; needed: number; readyAfterOne: boolean } {
  const copies = allUnitRefs(player).filter(({ unit }) => unit.championId === championId);
  const baseCopies = copies.reduce((sum, { unit }) => sum + Math.pow(3, unit.star - 1), 0);
  const highestStar = copies.reduce((max, { unit }) => Math.max(max, unit.star), 0);
  if (highestStar >= 3) return { baseCopies, highestStar, nextStar: null, needed: 9, readyAfterOne: false };
  const nextStar = Math.max(2, highestStar + 1);
  const needed = Math.pow(3, nextStar - 1);
  return { baseCopies, highestStar, nextStar, needed, readyAfterOne: baseCopies + 1 >= needed };
}

export function tryCombine(player: PlayerState, championId: number, star: number): string[] {
  const messages: string[] = [];
  let currentStar = star;
  while (currentStar < 3) {
    const copies = collectCopies(player, championId, currentStar);
    if (copies.length < 3) break;
    const consumed = copies.slice(0, 3);
    const inheritedItems = Array.from(new Set(consumed.flatMap(({ unit }) => unit.items))).slice(0, 2);
    const target = consumed[0];
    for (const copy of consumed) setUnitAt(player, copy.loc, null);
    const upgraded = makeUnit(championId, currentStar + 1, inheritedItems);
    setUnitAt(player, target.loc, upgraded);
    messages.push(`★${currentStar + 1} 合成完成`);
    currentStar += 1;
  }
  return messages;
}

export function canAcquireUnit(player: PlayerState, championId: number, star = 1): boolean {
  return firstEmptyBench(player) >= 0 || collectCopies(player, championId, star).length >= 2;
}

export function addUnitToBench(player: PlayerState, unit: UnitInstance): { ok: boolean; messages: string[] } {
  const empty = firstEmptyBench(player);
  if (empty >= 0) {
    player.bench[empty] = unit;
    const messages = tryCombine(player, unit.championId, unit.star);
    return { ok: true, messages };
  }

  // A full bench should not block a purchase that immediately combines. In that case the new
  // copy never needs a persistent bench slot: consume two existing copies and place the upgrade
  // where the first copy already was.
  const copies = collectCopies(player, unit.championId, unit.star);
  if (copies.length >= 2) {
    const consumed = copies.slice(0, 2);
    const inheritedItems = Array.from(new Set([...consumed.flatMap(({ unit: copy }) => copy.items), ...unit.items])).slice(0, 2);
    const target = consumed[0];
    for (const copy of consumed) setUnitAt(player, copy.loc, null);
    setUnitAt(player, target.loc, makeUnit(unit.championId, unit.star + 1, inheritedItems));
    const messages = [`★${unit.star + 1} 合成完成`];
    if (unit.star + 1 < 3) messages.push(...tryCombine(player, unit.championId, unit.star + 1));
    return { ok: true, messages };
  }
  return { ok: false, messages: ["备战席已满"] };
}

export function moveUnit(player: PlayerState, from: LocationRef, to: LocationRef): { ok: boolean; message?: string } {
  if (sameLocation(from, to)) return { ok: true };
  const source = getUnitAt(player, from);
  if (!source) return { ok: false, message: "这里没有棋子" };
  if (to.type === "board" && source && getUnitAt(player, to) == null && boardCount(player) >= deployLimit(player) && from.type !== "board") {
    return { ok: false, message: `上阵人数已达上限 ${deployLimit(player)}` };
  }
  const target = getUnitAt(player, to);
  setUnitAt(player, from, target ?? null);
  setUnitAt(player, to, source);
  return { ok: true };
}

export function removeUnit(player: PlayerState, loc: LocationRef): UnitInstance | null {
  const unit = getUnitAt(player, loc);
  setUnitAt(player, loc, null);
  return unit;
}

export function countCopiesEverywhere(players: PlayerState[], championId: number): number {
  let count = 0;
  for (const player of players) {
    for (const { unit } of allUnitRefs(player)) count += unit.championId === championId ? Math.pow(3, unit.star - 1) : 0;
    for (const slot of player.shop) if (slot.championId === championId && !slot.sold) count += 1;
  }
  return count;
}

export function createEmptyPlayer(id: number, name: string, isHuman: boolean): PlayerState {
  return {
    id,
    name,
    isHuman,
    alive: true,
    hp: 100,
    gold: isHuman ? 10 : 10,
    xp: 0,
    level: 2,
    board: {},
    bench: Array.from({ length: BENCH_SIZE }, () => null),
    shop: [],
    shopLocked: false,
    winStreak: 0,
    lossStreak: 0,
    augments: [],
    itemInventory: [],
    freeRerolls: 0,
    botPowerBonus: 1,
  };
}
