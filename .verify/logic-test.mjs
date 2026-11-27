// src/game/definitions.ts
var BENCH_SIZE = 9;

// src/game/roster.ts
var nextUid = 1;
function resetUid(seed = 1) {
  nextUid = seed * 1e5 + 1;
}
function makeUnit(championId, star = 1, items = []) {
  return { uid: `u${nextUid++}`, championId, star, items: items.slice() };
}
function boardKey(x, y) {
  return `${x},${y}`;
}
function setUnitAt(player2, loc, unit) {
  if (loc.type === "bench") {
    player2.bench[loc.index] = unit;
  } else {
    const key = boardKey(loc.x, loc.y);
    if (unit) player2.board[key] = unit;
    else delete player2.board[key];
  }
}
function allUnitRefs(player2) {
  const refs = [];
  for (const [key, unit] of Object.entries(player2.board)) {
    const [x, y] = key.split(",").map(Number);
    refs.push({ loc: { type: "board", x, y }, unit });
  }
  player2.bench.forEach((unit, index) => {
    if (unit) refs.push({ loc: { type: "bench", index }, unit });
  });
  return refs;
}
function firstEmptyBench(player2) {
  return player2.bench.findIndex((unit) => unit == null);
}
function collectCopies(player2, championId, star) {
  return allUnitRefs(player2).filter(({ unit }) => unit.championId === championId && unit.star === star);
}
function tryCombine(player2, championId, star) {
  const messages = [];
  let currentStar = star;
  while (currentStar < 3) {
    const copies2 = collectCopies(player2, championId, currentStar);
    if (copies2.length < 3) break;
    const consumed = copies2.slice(0, 3);
    const inheritedItems = Array.from(new Set(consumed.flatMap(({ unit }) => unit.items))).slice(0, 2);
    const target = consumed[0];
    for (const copy of consumed) setUnitAt(player2, copy.loc, null);
    const upgraded = makeUnit(championId, currentStar + 1, inheritedItems);
    setUnitAt(player2, target.loc, upgraded);
    messages.push(`\u2605${currentStar + 1} \u5408\u6210\u5B8C\u6210`);
    currentStar += 1;
  }
  return messages;
}
function addUnitToBench(player2, unit) {
  const empty = firstEmptyBench(player2);
  if (empty >= 0) {
    player2.bench[empty] = unit;
    const messages = tryCombine(player2, unit.championId, unit.star);
    return { ok: true, messages };
  }
  const copies2 = collectCopies(player2, unit.championId, unit.star);
  if (copies2.length >= 2) {
    const consumed = copies2.slice(0, 2);
    const inheritedItems = Array.from(/* @__PURE__ */ new Set([...consumed.flatMap(({ unit: copy }) => copy.items), ...unit.items])).slice(0, 2);
    const target = consumed[0];
    for (const copy of consumed) setUnitAt(player2, copy.loc, null);
    setUnitAt(player2, target.loc, makeUnit(unit.championId, unit.star + 1, inheritedItems));
    const messages = [`\u2605${unit.star + 1} \u5408\u6210\u5B8C\u6210`];
    if (unit.star + 1 < 3) messages.push(...tryCombine(player2, unit.championId, unit.star + 1));
    return { ok: true, messages };
  }
  return { ok: false, messages: ["\u5907\u6218\u5E2D\u5DF2\u6EE1"] };
}
function createEmptyPlayer(id, name, isHuman) {
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
    botPowerBonus: 1
  };
}

// .verify/logic-test.ts
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
resetUid(123);
var player = createEmptyPlayer(0, "test", true);
for (let i = 0; i < 3; i++) {
  const result2 = addUnitToBench(player, makeUnit(101001));
  assert(result2.ok, `normal add ${i} failed`);
}
var copies = allUnitRefs(player).filter(({ unit }) => unit.championId === 101001);
assert(copies.length === 1, `expected one unit after combine, got ${copies.length}`);
assert(copies[0].unit.star === 2, `expected star 2, got ${copies[0].unit.star}`);
var full = createEmptyPlayer(0, "full", true);
setUnitAt(full, { type: "bench", index: 0 }, makeUnit(202001));
setUnitAt(full, { type: "bench", index: 1 }, makeUnit(202001));
for (let i = 2; i < 9; i++) setUnitAt(full, { type: "bench", index: i }, makeUnit(3e5 + i));
var result = addUnitToBench(full, makeUnit(202001));
assert(result.ok, "full-bench combining purchase should be accepted");
copies = allUnitRefs(full).filter(({ unit }) => unit.championId === 202001);
assert(copies.length === 1 && copies[0].unit.star === 2, `expected full-bench star2 combine, got ${JSON.stringify(copies)}`);
assert(allUnitRefs(full).length === 8, `expected 8 total units after 3-to-1 combine on full bench, got ${allUnitRefs(full).length}`);
var chain = createEmptyPlayer(0, "chain", true);
for (let i = 0; i < 9; i++) addUnitToBench(chain, makeUnit(303001));
copies = allUnitRefs(chain).filter(({ unit }) => unit.championId === 303001);
assert(copies.length === 1 && copies[0].unit.star === 3, `expected chained star3, got ${JSON.stringify(copies)}`);
console.log("logic tests passed");
