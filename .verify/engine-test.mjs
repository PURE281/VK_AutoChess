// .verify/engine-test.ts
import { readFileSync } from "node:fs";

// src/game/definitions.ts
var BENCH_SIZE = 9;
var XP_TO_NEXT = {
  1: 2,
  2: 6,
  3: 18,
  4: 30,
  5: 46,
  6: 66,
  7: 90,
  8: 120,
  9: 999
};
var SHOP_ODDS = {
  1: [100, 0, 0, 0, 0],
  2: [90, 10, 0, 0, 0],
  3: [75, 22, 3, 0, 0],
  4: [60, 30, 9, 1, 0],
  5: [45, 33, 18, 4, 0],
  6: [35, 35, 22, 8, 0],
  7: [25, 32, 27, 13, 3],
  8: [20, 28, 30, 17, 5],
  9: [15, 25, 30, 20, 10]
};
var POOL_COPIES = {
  1: 29,
  2: 22,
  3: 18,
  4: 12,
  5: 9
};
var AUGMENTS = [
  { id: "gold_flow", name: "\u8D22\u5BCC\u6D8C\u6CC9", tier: 1, description: "\u5229\u606F\u4E0A\u9650 +2\uFF0C\u6BCF\u56DE\u5408\u989D\u5916 +1 \u91D1\u5E01\u3002", tags: ["econ"] },
  { id: "war_treasury", name: "\u6218\u4E89\u8D22\u653F", tier: 1, description: "PVP \u80DC\u5229\u540E\u989D\u5916\u83B7\u5F97 2 \u91D1\u5E01\u3002", tags: ["econ", "combat"] },
  { id: "studious", name: "\u7ECF\u9A8C\u7814\u4E60", tier: 1, description: "\u8D2D\u4E70\u7ECF\u9A8C\u65F6\u989D\u5916\u83B7\u5F97 2 \u70B9\u7ECF\u9A8C\u3002", tags: ["econ"] },
  { id: "cheap_refresh", name: "\u5546\u4EBA\u4EA4\u60C5", tier: 1, description: "\u5237\u65B0\u5546\u5E97\u53EA\u6D88\u8017 1 \u91D1\u5E01\u3002", tags: ["econ"] },
  { id: "oracle_refresh", name: "\u795E\u8C15\u5237\u65B0", tier: 2, description: "\u6BCF\u56DE\u5408\u7B2C\u4E00\u6B21\u5237\u65B0\u514D\u8D39\u3002", tags: ["econ"] },
  { id: "golden_injection", name: "\u9EC4\u91D1\u6CE8\u5165", tier: 1, description: "\u7ACB\u5373\u83B7\u5F97 12 \u91D1\u5E01\u3002", tags: ["econ"] },
  { id: "fast_training", name: "\u8FDB\u9636\u8BAD\u7EC3", tier: 1, description: "\u7ACB\u5373\u83B7\u5F97 8 \u70B9\u7ECF\u9A8C\u3002", tags: ["econ"] },
  { id: "extra_deploy", name: "\u5F81\u53EC\u6269\u5C55", tier: 2, description: "\u53EF\u4E0A\u9635\u4EBA\u6570 +1\u3002", tags: ["combat"] },
  { id: "duplicator", name: "\u82F1\u96C4\u590D\u5236\u5668", tier: 2, description: "\u83B7\u5F97\u6D88\u8017\u54C1\u300C\u82F1\u96C4\u590D\u5236\u5668\u300D\uFF0C\u53EF\u4EFB\u9009\u4E00\u540D\u5DF2\u62E5\u6709\u68CB\u5B50\u8FDB\u884C\u590D\u5236\u3002", tags: ["econ"] },
  { id: "healthy_body", name: "\u5F3A\u5065\u4F53\u9B44", tier: 1, description: "\u5168\u4F53\u53CB\u519B\u6700\u5927\u751F\u547D +8%\u3002", tags: ["combat"] },
  { id: "swift_tactics", name: "\u8FC5\u6377\u6218\u672F", tier: 1, description: "\u5168\u4F53\u53CB\u519B\u653B\u51FB\u901F\u5EA6 +8%\u3002", tags: ["combat"] },
  { id: "critical_lesson", name: "\u66B4\u51FB\u8BAD\u7EC3", tier: 1, description: "\u5168\u4F53\u53CB\u519B\u66B4\u51FB\u7387 +10%\u3002", tags: ["combat"] },
  { id: "holy_word", name: "\u6CBB\u6108\u5723\u8A00", tier: 2, description: "\u6CBB\u7597\u4E0E\u62A4\u76FE\u6548\u679C +20%\u3002", tags: ["combat"] },
  { id: "crafted_barrier", name: "\u7CBE\u5DE5\u62A4\u76FE", tier: 2, description: "\u6218\u6597\u5F00\u59CB\u65F6\uFF0C\u5168\u4F53\u53CB\u519B\u83B7\u5F97\u76F8\u5F53\u4E8E\u6700\u5927\u751F\u547D 12% \u7684\u62A4\u76FE\u3002", tags: ["combat"] },
  { id: "elemental_attune", name: "\u5143\u7D20\u534F\u8C03", tier: 2, description: "\u5C5E\u6027\u514B\u5236\u4F24\u5BB3\u52A0\u6210\u63D0\u9AD8 10%\u3002", tags: ["combat"] },
  { id: "mana_spring", name: "\u9B54\u529B\u6E90\u6CC9", tier: 2, description: "\u53CB\u519B\u6218\u6597\u5F00\u59CB\u65F6\u83B7\u5F97 20 \u70B9\u6CD5\u529B\u3002", tags: ["combat"] },
  { id: "executioner", name: "\u5904\u51B3\u8005", tier: 3, description: "\u53CB\u519B\u5BF9\u751F\u547D\u4F4E\u4E8E 30% \u7684\u654C\u4EBA\u9020\u6210 15% \u989D\u5916\u4F24\u5BB3\u3002", tags: ["combat"] },
  { id: "last_stand", name: "\u80CC\u6C34\u4E00\u6218", tier: 3, description: "\u4F60\u7684\u751F\u547D\u503C\u4F4E\u4E8E 35 \u65F6\uFF0C\u5168\u4F53\u53CB\u519B\u4F24\u5BB3 +12%\u3002", tags: ["combat"] }
];
var ITEMS = [
  { id: "godslayer_blade", name: "\u795E\u65A9\u5251", tier: 1, icon: "\u2694", description: "\u7269\u7406\u4F24\u5BB3 +18%\u3002", tags: ["offense"] },
  { id: "sage_staff", name: "\u8D24\u8005\u4E4B\u6756", tier: 1, icon: "\u2726", description: "\u9B54\u6CD5\u4F24\u5BB3\u4E0E\u6CBB\u7597\u6548\u679C +18%\u3002", tags: ["offense"] },
  { id: "giant_belt", name: "\u5DE8\u4EBA\u8170\u5E26", tier: 1, icon: "\u25C6", description: "\u6700\u5927\u751F\u547D +18%\u3002", tags: ["defense"] },
  { id: "mithril_plate", name: "\u79D8\u94F6\u94E0\u7532", tier: 1, icon: "\u25A3", description: "\u7269\u7406\u4E0E\u9B54\u6CD5\u9632\u5FA1 +18%\u3002", tags: ["defense"] },
  { id: "gale_boots", name: "\u75BE\u98CE\u9774", tier: 1, icon: "\u226B", description: "\u653B\u51FB\u901F\u5EA6 +15%\u3002", tags: ["offense"] },
  { id: "crit_claw", name: "\u66B4\u51FB\u722A", tier: 1, icon: "\u2727", description: "\u66B4\u51FB\u7387 +15%\uFF0C\u66B4\u51FB\u4F24\u5BB3 +20%\u3002", tags: ["offense"] },
  { id: "holy_charm", name: "\u5723\u5149\u62A4\u7B26", tier: 1, icon: "\u271A", description: "\u6CBB\u7597\u4E0E\u62A4\u76FE\u6548\u679C +25%\u3002", tags: ["support"] },
  { id: "mana_core", name: "\u9B54\u529B\u6838\u5FC3", tier: 2, icon: "\u25C9", description: "\u6218\u6597\u5F00\u59CB\u65F6\u83B7\u5F97 30 \u70B9\u6CD5\u529B\u3002", tags: ["support"] },
  { id: "vampire_fang", name: "\u5438\u8840\u7259", tier: 2, icon: "\u2666", description: "\u9020\u6210\u4F24\u5BB3\u7684 15% \u8F6C\u5316\u4E3A\u751F\u547D\u3002", tags: ["offense"] },
  { id: "frost_sigil", name: "\u51B0\u971C\u5370\u8BB0", tier: 2, icon: "\u2744", description: "\u666E\u653B\u4F7F\u547D\u4E2D\u7684\u654C\u4EBA\u653B\u901F\u964D\u4F4E 12%\uFF0C\u6301\u7EED 2 \u79D2\u3002", tags: ["control"] },
  { id: "thunder_hammer", name: "\u96F7\u795E\u9524", tier: 2, icon: "\u26A1", description: "\u6BCF\u7B2C\u4E09\u6B21\u666E\u653B\u6E85\u5C04 35% \u4F24\u5BB3\u3002", tags: ["offense"] },
  { id: "rebirth_feather", name: "\u590D\u6D3B\u7FBD", tier: 3, icon: "\u2671", description: "\u6BCF\u573A\u6218\u6597\u4E00\u6B21\uFF0C\u9635\u4EA1\u540E\u4EE5 30% \u751F\u547D\u590D\u6D3B\u3002", tags: ["defense"] },
  { id: "hero_duplicator", name: "\u82F1\u96C4\u590D\u5236\u5668", tier: 3, icon: "\u29C9", description: "\u6D88\u8017\u54C1\uFF1A\u5BF9\u4EFB\u610F\u5DF2\u62E5\u6709\u68CB\u5B50\u4F7F\u7528\uFF0C\u5728\u5907\u6218\u5E2D\u751F\u6210\u4E00\u4E2A\u540C\u661F\u7EA7\u590D\u5236\u4F53\uFF1B\u4E0D\u7EE7\u627F\u795E\u5668\u3002", tags: ["econ", "consumable"] }
];
var RACE_TRAITS = [
  { race: 1, breakpoints: [2, 4, 6], description: "\u795E\u65CF\uFF1A\u6CD5\u529B\u83B7\u53D6 +15/30/50%\uFF0C\u6CBB\u7597\u62A4\u76FE +10/20/35%\u3002" },
  { race: 2, breakpoints: [2, 4, 6], description: "\u4EBA\u7C7B\uFF1A\u653B\u51FB\u4E0E\u9B54\u6CD5\u5F3A\u5EA6 +8/15/25%\uFF0CPVP \u80DC\u5229\u989D\u5916\u91D1\u5E01\u3002" },
  { race: 3, breakpoints: [2, 4, 6], description: "\u7CBE\u7075\uFF1A\u95EA\u907F +8/15/25%\uFF0C\u653B\u901F +8/15/25%\u3002" },
  { race: 4, breakpoints: [2, 4], description: "\u77EE\u4EBA\uFF1A\u53CC\u9632 +20/40%\uFF0C\u6700\u5927\u751F\u547D +8/16%\u3002" },
  { race: 5, breakpoints: [2, 4, 6], description: "\u4E9A\u4EBA\uFF1A\u653B\u901F +10/22/40%\uFF0C\u751F\u547D\u5077\u53D6 +6/12/20%\u3002" },
  { race: 6, breakpoints: [2, 4], description: "\u5DE8\u4EBA\uFF1A\u6700\u5927\u751F\u547D +15/30%\uFF0C\u53D7\u63A7\u65F6\u95F4\u7F29\u77ED\u3002" },
  { race: 7, breakpoints: [2, 4], description: "\u795E\u517D\uFF1A\u6280\u80FD\u9644\u52A0\u707C\u70E7/\u771F\u4F24\uFF0C\u5143\u7D20\u4F24\u5BB3\u63D0\u9AD8\u3002" },
  { race: 8, breakpoints: [2, 4], description: "\u5E7B\u7075\uFF1A\u521D\u59CB\u6CD5\u529B +15/35\uFF0C\u6280\u80FD\u6548\u679C\u589E\u5F3A\u3002" }
];
var ELEMENT_TRAITS = [
  { element: 2, breakpoints: [2, 4, 6], description: "\u706B\uFF1A\u706B\u5C5E\u6027\u82F1\u7075\u4F24\u5BB3 +8/16/28%\uFF0C\u6280\u80FD\u707C\u70E7\u589E\u5F3A\u3002" },
  { element: 4, breakpoints: [2, 4, 6], description: "\u6C34\uFF1A\u6C34\u5C5E\u6027\u82F1\u7075\u6CD5\u529B\u83B7\u53D6 +12/24/40%\uFF0C\u6CBB\u7597\u589E\u5F3A\u3002" },
  { element: 8, breakpoints: [2, 4, 6], description: "\u6728\uFF1A\u6728\u5C5E\u6027\u82F1\u7075\u6700\u5927\u751F\u547D +8/16/26%\uFF0C\u6297\u6027\u589E\u5F3A\u3002" },
  { element: 16, breakpoints: [2, 4], description: "\u5149\uFF1A\u5149\u5C5E\u6027\u82F1\u7075\u5F00\u573A\u62A4\u76FE +10/20% \u751F\u547D\uFF0C\u6CBB\u7597\u589E\u5F3A\u3002" },
  { element: 32, breakpoints: [2, 4], description: "\u6697\uFF1A\u6697\u5C5E\u6027\u82F1\u7075\u66B4\u51FB +10/20%\uFF0C\u751F\u547D\u5077\u53D6 +8/15%\u3002" }
];
var ROLE_TRAITS = [
  { role: "berserker", breakpoints: [2, 4], description: "\u72C2\u6218\uFF1A\u7269\u7406\u4F24\u5BB3 +15/30%\uFF0C\u51FB\u6740\u540E\u6062\u590D\u751F\u547D\u3002" },
  { role: "assassin", breakpoints: [2, 4], description: "\u523A\u5BA2\uFF1A\u66B4\u51FB\u7387 +18/38%\uFF0C\u6218\u6597\u5F00\u59CB\u8DC3\u5165\u540E\u6392\u3002" },
  { role: "ranger", breakpoints: [2, 4], description: "\u6E38\u4FA0\uFF1A\u653B\u901F +18/38%\uFF0C\u5C04\u7A0B\u589E\u52A0\u3002" },
  { role: "arcanist", breakpoints: [2, 4], description: "\u9B54\u5BFC\uFF1A\u9B54\u6CD5\u4F24\u5BB3 +15/32%\uFF0C\u6280\u80FD\u6E85\u5C04\u3002" },
  { role: "warlock", breakpoints: [2, 4], description: "\u5492\u672F\uFF1A\u51CF\u76CA\u4E0E\u5F02\u5E38\u6548\u679C\u589E\u5F3A\uFF0C\u654C\u65B9\u6297\u6027\u4E0B\u964D\u3002" },
  { role: "priest", breakpoints: [2, 4], description: "\u796D\u53F8\uFF1A\u6CBB\u7597\u4E0E\u62A4\u76FE +22/45%\uFF0C\u4F4E\u751F\u547D\u53CB\u519B\u83B7\u5F97\u5E87\u62A4\u3002" },
  { role: "warden", breakpoints: [2, 4], description: "\u94C1\u536B\uFF1A\u53CC\u9632 +20/42%\uFF0C\u5F00\u573A\u5632\u8BBD\u90BB\u8FD1\u654C\u4EBA\u3002" },
  { role: "templar", breakpoints: [2, 4], description: "\u5723\u76FE\uFF1A\u5F00\u573A\u62A4\u76FE\u4E0E\u6301\u7EED\u51CF\u4F24\u3002" }
];

// src/data.ts
function primaryElement(mask) {
  for (const bit of [2, 4, 8, 16, 32]) if ((mask & bit) !== 0) return bit;
  return 1;
}

// src/game/random.ts
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a += 1831565813;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickOne(rng, values) {
  return values[Math.floor(rng() * values.length)];
}
function shuffle(rng, input) {
  const arr = input.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function weightedPick(rng, entries) {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const [value, weight] of entries) {
    roll -= Math.max(0, weight);
    if (roll <= 0) return value;
  }
  return entries.length ? entries[entries.length - 1][0] : null;
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

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
function sameLocation(a, b) {
  if (a.type !== b.type) return false;
  if (a.type === "bench" && b.type === "bench") return a.index === b.index;
  if (a.type === "board" && b.type === "board") return a.x === b.x && a.y === b.y;
  return false;
}
function getUnitAt(player, loc) {
  if (loc.type === "bench") return player.bench[loc.index] ?? null;
  return player.board[boardKey(loc.x, loc.y)] ?? null;
}
function setUnitAt(player, loc, unit) {
  if (loc.type === "bench") {
    player.bench[loc.index] = unit;
  } else {
    const key = boardKey(loc.x, loc.y);
    if (unit) player.board[key] = unit;
    else delete player.board[key];
  }
}
function allUnitRefs(player) {
  const refs = [];
  for (const [key, unit] of Object.entries(player.board)) {
    const [x, y] = key.split(",").map(Number);
    refs.push({ loc: { type: "board", x, y }, unit });
  }
  player.bench.forEach((unit, index) => {
    if (unit) refs.push({ loc: { type: "bench", index }, unit });
  });
  return refs;
}
function boardCount(player) {
  return Object.keys(player.board).length;
}
function deployLimit(player) {
  return player.level + (player.augments.includes("extra_deploy") ? 1 : 0);
}
function firstEmptyBench(player) {
  return player.bench.findIndex((unit) => unit == null);
}
function createPool(activeRoster) {
  const pool = {};
  for (const champion of activeRoster) {
    pool[champion.id] = POOL_COPIES[champion.cost] ?? 12;
  }
  return pool;
}
function rollShop(player, pool, roster, rng) {
  const odds = SHOP_ODDS[Math.min(9, Math.max(1, player.level))] ?? SHOP_ODDS[1];
  const slots = [];
  for (let slot = 0; slot < 5; slot++) {
    const costEntries = odds.map((weight, index) => [index + 1, weight]).filter(([cost2]) => roster.some((c) => c.cost === cost2 && (pool[c.id] ?? 0) > 0));
    const cost = weightedPick(rng, costEntries);
    if (!cost) {
      slots.push({ championId: null });
      continue;
    }
    const candidates = roster.filter((c) => c.cost === cost && (pool[c.id] ?? 0) > 0).map((c) => [c.id, 1]);
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
function refundPool(pool, championId, amount = 1) {
  pool[championId] = (pool[championId] ?? 0) + amount;
}
function sellValue(champion, star) {
  const copies = Math.pow(3, star - 1);
  return Math.max(1, Math.floor(champion.cost * copies * (star === 1 ? 1 : 0.92)));
}
function collectCopies(player, championId, star) {
  return allUnitRefs(player).filter(({ unit }) => unit.championId === championId && unit.star === star);
}
function tryCombine(player, championId, star) {
  const messages = [];
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
    messages.push(`\u2605${currentStar + 1} \u5408\u6210\u5B8C\u6210`);
    currentStar += 1;
  }
  return messages;
}
function addUnitToBench(player, unit) {
  const empty = firstEmptyBench(player);
  if (empty >= 0) {
    player.bench[empty] = unit;
    const messages = tryCombine(player, unit.championId, unit.star);
    return { ok: true, messages };
  }
  const copies = collectCopies(player, unit.championId, unit.star);
  if (copies.length >= 2) {
    const consumed = copies.slice(0, 2);
    const inheritedItems = Array.from(/* @__PURE__ */ new Set([...consumed.flatMap(({ unit: copy }) => copy.items), ...unit.items])).slice(0, 2);
    const target = consumed[0];
    for (const copy of consumed) setUnitAt(player, copy.loc, null);
    setUnitAt(player, target.loc, makeUnit(unit.championId, unit.star + 1, inheritedItems));
    const messages = [`\u2605${unit.star + 1} \u5408\u6210\u5B8C\u6210`];
    if (unit.star + 1 < 3) messages.push(...tryCombine(player, unit.championId, unit.star + 1));
    return { ok: true, messages };
  }
  return { ok: false, messages: ["\u5907\u6218\u5E2D\u5DF2\u6EE1"] };
}
function moveUnit(player, from, to) {
  if (sameLocation(from, to)) return { ok: true };
  const source = getUnitAt(player, from);
  if (!source) return { ok: false, message: "\u8FD9\u91CC\u6CA1\u6709\u68CB\u5B50" };
  if (to.type === "board" && source && getUnitAt(player, to) == null && boardCount(player) >= deployLimit(player) && from.type !== "board") {
    return { ok: false, message: `\u4E0A\u9635\u4EBA\u6570\u5DF2\u8FBE\u4E0A\u9650 ${deployLimit(player)}` };
  }
  const target = getUnitAt(player, to);
  setUnitAt(player, from, target ?? null);
  setUnitAt(player, to, source);
  return { ok: true };
}
function removeUnit(player, loc) {
  const unit = getUnitAt(player, loc);
  setUnitAt(player, loc, null);
  return unit;
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

// src/game/balance.ts
function winStreakGoldBonus(streak) {
  if (streak >= 6) return 3;
  if (streak >= 4) return 2;
  if (streak >= 2) return 1;
  return 0;
}
function lossStreakGoldBonus(streak) {
  if (streak >= 5) return 4;
  if (streak >= 4) return 3;
  if (streak >= 3) return 2;
  if (streak >= 2) return 1;
  return 0;
}
function itemTierWeight(tier, lossStreak) {
  if (lossStreak >= 4) return tier === 1 ? 1 : tier === 2 ? 3 : 5;
  if (lossStreak === 3) return tier === 1 ? 2 : tier === 2 ? 4 : 3;
  if (lossStreak === 2) return tier === 1 ? 3 : tier === 2 ? 4 : 2;
  return tier === 1 ? 5 : tier === 2 ? 3 : 1;
}
function augmentTierWeight(tier, lossStreak) {
  if (lossStreak >= 4) return tier === 1 ? 1 : tier === 2 ? 3 : 5;
  if (lossStreak === 3) return tier === 1 ? 2 : tier === 2 ? 4 : 3;
  if (lossStreak === 2) return tier === 1 ? 3 : tier === 2 ? 3 : 2;
  return tier === 1 ? 4 : tier === 2 ? 2 : 1;
}
function weightedSample(rng, values, count, weightFor) {
  const remaining = values.slice();
  const selected = [];
  while (remaining.length && selected.length < count) {
    const entries = remaining.map((value, index) => [{ value, index }, weightFor(value)]);
    const picked = weightedPick(rng, entries);
    if (!picked) break;
    selected.push(picked.value);
    remaining.splice(picked.index, 1);
  }
  return selected;
}
function replaceWeakest(selected, replacement) {
  let weakestIndex = 0;
  for (let i = 1; i < selected.length; i++) {
    if (selected[i].tier < selected[weakestIndex].tier) weakestIndex = i;
  }
  selected[weakestIndex] = replacement;
}
function chooseBalancedItems(rng, lossStreak = 0, count = 3) {
  const selected = weightedSample(rng, ITEMS, count, (item) => itemTierWeight(item.tier, lossStreak));
  if (!selected.length) return selected;
  if (lossStreak >= 2 && !selected.some((item) => item.tier >= 2)) {
    const candidates = ITEMS.filter((item) => item.tier >= 2 && !selected.some((picked) => picked.id === item.id));
    const replacement = weightedSample(rng, candidates, 1, (item) => itemTierWeight(item.tier, lossStreak))[0];
    if (replacement) replaceWeakest(selected, replacement);
  }
  if (lossStreak >= 4 && !selected.some((item) => item.tier === 3)) {
    const candidates = ITEMS.filter((item) => item.tier === 3 && !selected.some((picked) => picked.id === item.id));
    const replacement = weightedSample(rng, candidates, 1, () => 1)[0];
    if (replacement) replaceWeakest(selected, replacement);
  }
  return selected;
}
function augmentTierCap(round, lossStreak) {
  const base = round >= 12 ? 3 : round >= 7 ? 2 : 1;
  return Math.min(3, base + (lossStreak >= 2 ? 1 : 0));
}
function chooseBalancedAugments(rng, round, owned, lossStreak = 0, count = 3) {
  const cap = augmentTierCap(round, lossStreak);
  const pool = AUGMENTS.filter((augment) => augment.tier <= cap && !owned.includes(augment.id));
  const selected = weightedSample(rng, pool, count, (augment) => augmentTierWeight(augment.tier, lossStreak));
  if (!selected.length) return selected;
  const bestAvailable = Math.max(...pool.map((augment) => augment.tier));
  if (lossStreak >= 3 && bestAvailable > 1 && !selected.some((augment) => augment.tier === bestAvailable)) {
    const candidates = pool.filter((augment) => augment.tier === bestAvailable && !selected.some((picked) => picked.id === augment.id));
    const replacement = weightedSample(rng, candidates, 1, () => 1)[0];
    if (replacement) replaceWeakest(selected, replacement);
  }
  return selected;
}

// src/game/bots.ts
var BOT_NAMES = [
  "\u971C\u6708\u65C5\u4EBA",
  "\u4E9A\u65AF\u683C\u7279\u8001\u5175",
  "\u5E7B\u5F71\u68CB\u624B",
  "\u5BC6\u7C73\u5C14\u4E4B\u58F0",
  "\u9EC4\u660F\u89C2\u6D4B\u8005",
  "\u5F69\u8679\u6865\u5B88\u536B",
  "\u4E16\u754C\u6811\u6839\u7CFB",
  "\u82F1\u7075\u5019\u8865",
  "\u6708\u8BFB\u4FE1\u5F92",
  "\u5DE8\u4EBA\u730E\u624B",
  "\u7CBE\u7075\u5DE1\u6797\u5BA2",
  "\u6DF1\u6D77\u796D\u53F8"
];
function createBots(count, rng) {
  const personalities = ["econ", "aggressive", "vertical", "balanced"];
  const names = shuffle(rng, BOT_NAMES);
  const bots = [];
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
function drawChampionId(player, pool, roster, rng) {
  const odds = SHOP_ODDS[Math.min(9, player.level)] ?? SHOP_ODDS[1];
  const costEntries = odds.map((weight, index) => [index + 1, weight]).filter(([cost2]) => roster.some((c) => c.cost === cost2 && (pool[c.id] ?? 0) > 0));
  const cost = weightedPick(rng, costEntries);
  if (!cost) return null;
  const candidates = roster.filter((c) => c.cost === cost && (pool[c.id] ?? 0) > 0).map((c) => [c.id, 1]);
  return weightedPick(rng, candidates);
}
function unitValue(unit, champion, preference) {
  if (!champion) return 0;
  let value = champion.cost * Math.pow(2.25, unit.star - 1);
  if (preference && champion.race === preference) value *= 1.28;
  if (unit.star >= 2) value *= 1.18;
  return value;
}
function botShouldBuy(bot, champion, rng) {
  if (!bot.personality) return true;
  if (bot.personality === "vertical") return champion.race === bot.traitPreference || champion.cost >= 3 || rng() < 0.2;
  if (bot.personality === "aggressive") return champion.cost <= 3 || rng() < 0.45;
  if (bot.personality === "econ") return champion.cost >= 2 || rng() < 0.35;
  return true;
}
function teamSynergyScore(units, champions2) {
  const races = /* @__PURE__ */ new Map();
  const roles = /* @__PURE__ */ new Map();
  const elements = /* @__PURE__ */ new Map();
  const seen = /* @__PURE__ */ new Set();
  for (const unit of units) {
    if (seen.has(unit.championId)) continue;
    const champion = champions2.get(unit.championId);
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
function deployBestUnits(bot, champions2) {
  const all = allUnitRefs(bot).map(({ unit }) => unit);
  const unique = /* @__PURE__ */ new Map();
  for (const unit of all) unique.set(unit.uid, unit);
  const units = Array.from(unique.values()).sort((a, b) => {
    const ca = champions2.get(a.championId);
    const cb = champions2.get(b.championId);
    return unitValue(b, cb, bot.traitPreference) - unitValue(a, ca, bot.traitPreference);
  });
  const count = Math.min(deployLimit(bot), units.length);
  const chosen = [];
  const remaining = units.slice();
  while (chosen.length < count && remaining.length) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const base = unitValue(candidate, champions2.get(candidate.championId), bot.traitPreference);
      const synergy = teamSynergyScore([...chosen, candidate], champions2) - teamSynergyScore(chosen, champions2);
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
    const role = champions2.get(u.championId)?.role;
    return role === "warden" || role === "templar" || role === "berserker";
  });
  const middle = chosen.filter((u) => champions2.get(u.championId)?.role === "assassin");
  const back = chosen.filter((u) => !front.includes(u) && !middle.includes(u));
  let index = 0;
  const place = (unit, x, y) => {
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
function runBotTurn(bot, pool, roster, champions2, rng, round) {
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
    const champion = champions2.get(cid);
    if (!champion) continue;
    const wants = botShouldBuy(bot, champion, rng) && bot.gold - reserve >= champion.cost;
    const benchSpace = firstEmptyBench(bot) >= 0 || allUnitRefs(bot).some(({ unit }) => unit.championId === cid && unit.star < 3);
    if (wants && benchSpace) {
      bot.gold -= champion.cost;
      pool[cid] = Math.max(0, (pool[cid] ?? 0) - 1);
      addUnitToBench(bot, makeUnit(cid));
    }
  }
  if (firstEmptyBench(bot) < 0) {
    const benchEntries = bot.bench.map((unit, index) => ({ unit, index })).filter((entry) => Boolean(entry.unit)).sort((a, b) => unitValue(a.unit, champions2.get(a.unit.championId), bot.traitPreference) - unitValue(b.unit, champions2.get(b.unit.championId), bot.traitPreference));
    const worst = benchEntries[0];
    if (worst && boardCount(bot) >= Math.max(1, deployLimit(bot) - 1)) {
      const champion = champions2.get(worst.unit.championId);
      if (champion) bot.gold += sellValue(champion, worst.unit.star);
      bot.bench[worst.index] = null;
    }
  }
  deployBestUnits(bot, champions2);
  const augmentCount = [3, 8, 13].filter((r) => round >= r).length;
  while (bot.augments.length < augmentCount) {
    const augment = chooseBalancedAugments(rng, round, bot.augments, bot.lossStreak, 1)[0];
    if (!augment) break;
    bot.augments.push(augment.id);
    if (["healthy_body", "swift_tactics", "critical_lesson", "holy_word", "crafted_barrier", "elemental_attune", "mana_spring", "executioner", "last_stand", "extra_deploy"].includes(augment.id)) {
      bot.botPowerBonus += 0.035;
    } else {
      bot.gold += 4;
    }
  }
  bot.botPowerBonus = clamp(bot.botPowerBonus + (rng() - 0.48) * 6e-3, 0.9, 1.18);
  for (const { unit } of allUnitRefs(bot)) tryCombine(bot, unit.championId, unit.star);
}
function teamPower(player, champions2) {
  let power = 0;
  for (const unit of Object.values(player.board)) {
    const champion = champions2.get(unit.championId);
    if (!champion) continue;
    const starMult = [1, 1.8, 3.1][unit.star - 1] ?? 1;
    power += (55 + champion.cost * 34) * starMult * (1 + unit.items.length * 0.12);
  }
  power *= player.botPowerBonus || 1;
  power *= 1 + Math.max(0, player.level - 2) * 0.025;
  return power;
}
function resolveBotBattles(players, champions2, rng, round, excludeBotId = -1) {
  const messages = [];
  const bots = shuffle(rng, players.filter((p) => !p.isHuman && p.alive && p.id !== excludeBotId));
  const pairs = [];
  for (let i = 0; i < bots.length; i += 2) pairs.push([bots[i], bots[i + 1] ?? null]);
  for (const [a, b] of pairs) {
    const pa = teamPower(a, champions2) * (0.86 + rng() * 0.3);
    const pb = b ? teamPower(b, champions2) * (0.86 + rng() * 0.3) : pa * (0.72 + rng() * 0.12);
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
        messages.push(`${loser.name} \u5728\u7B2C ${round} \u56DE\u5408\u88AB\u6DD8\u6C70`);
      }
    }
  }
  return messages;
}
function chooseHumanOpponent(players, rng) {
  const human2 = players.find((p) => p.isHuman);
  const candidates = players.filter((p) => !p.isHuman && p.alive && p.id !== human2?.lastOpponentId);
  if (!candidates.length) return players.find((p) => !p.isHuman && p.alive) ?? null;
  return pickOne(rng, candidates);
}

// src/game/combat.ts
function levelValue(values, level) {
  if (level <= 0) return 0;
  return values[Math.min(values.length, level) - 1] ?? 0;
}
function isPhysical(champion) {
  return champion.attackType === 1 || champion.classType === 1;
}
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function elementMultiplier(attacker, defender, bonus) {
  if (attacker === defender || attacker === 1 || defender === 1 || attacker === 64 || defender === 64) return 1;
  const strong = attacker === 2 && defender === 8 || attacker === 8 && defender === 4 || attacker === 4 && defender === 2 || (attacker === 16 || attacker === 32) && (defender === 16 || defender === 32) && attacker !== defender;
  if (strong) return 1 + 0.12 + bonus;
  const weak = defender === 2 && attacker === 8 || defender === 8 && attacker === 4 || defender === 4 && attacker === 2;
  return weak ? 0.94 : 1;
}
function makeRuntimeUnits(side, input, idStart) {
  let id = idStart;
  const units = input.entries.map(({ unit, champion, x, y }) => {
    const starMult = [1, 1.72, 2.85][unit.star - 1] ?? 1;
    const costScale = 0.88 + champion.cost * 0.12;
    const shape = champion.statShape;
    const role = champion.role;
    const raceTrait = input.traits.races[champion.race] ?? 0;
    const roleTrait = input.traits.roles[role] ?? 0;
    const ownElement = primaryElement(champion.elementMask);
    const elementTrait = input.traits.elements?.[ownElement] ?? 0;
    const powerBonus = input.powerBonus ?? 1;
    let hp = (620 + champion.cost * 145) * starMult * shape.hp;
    let attack = (44 + champion.cost * 11.5) * starMult * shape.physical_attack;
    let magic = (44 + champion.cost * 11.5) * starMult * shape.magic_attack;
    let armor = (24 + champion.cost * 5.2) * Math.pow(starMult, 0.55) * shape.physical_defense;
    let resist = (24 + champion.cost * 5.2) * Math.pow(starMult, 0.55) * shape.magic_defense;
    let speed = 0.68 + shape.agility * 0.25;
    let range = champion.range;
    let crit = 0.07 + (shape.critical - 0.78) * 0.18;
    let critDamage = 1.55;
    let dodge = 0.035 + (shape.dodge - 0.78) * 0.12;
    let lifesteal = 0;
    let manaGain = 1;
    let damageAmp = 1;
    let skillAmp = 1;
    let healAmp = 1;
    let mana = role === "priest" || role === "warlock" ? 18 : 8;
    let shield = 0;
    manaGain *= 1 + levelValue([0.15, 0.3, 0.5], champion.race === 1 ? raceTrait : 0);
    healAmp *= 1 + levelValue([0.1, 0.2, 0.35], champion.race === 1 ? raceTrait : 0);
    damageAmp *= 1 + levelValue([0.08, 0.15, 0.25], champion.race === 2 ? raceTrait : 0);
    dodge += levelValue([0.08, 0.15, 0.25], champion.race === 3 ? raceTrait : 0);
    speed *= 1 + levelValue([0.08, 0.15, 0.25], champion.race === 3 ? raceTrait : 0);
    armor *= 1 + levelValue([0.2, 0.4], champion.race === 4 ? raceTrait : 0);
    resist *= 1 + levelValue([0.2, 0.4], champion.race === 4 ? raceTrait : 0);
    hp *= 1 + levelValue([0.08, 0.16], champion.race === 4 ? raceTrait : 0);
    speed *= 1 + levelValue([0.1, 0.22, 0.4], champion.race === 5 ? raceTrait : 0);
    lifesteal += levelValue([0.06, 0.12, 0.2], champion.race === 5 ? raceTrait : 0);
    hp *= 1 + levelValue([0.15, 0.3], champion.race === 6 ? raceTrait : 0);
    skillAmp *= 1 + levelValue([0.1, 0.22], champion.race === 7 ? raceTrait : 0);
    mana += levelValue([15, 35], champion.race === 8 ? raceTrait : 0);
    skillAmp *= 1 + levelValue([0.08, 0.18], champion.race === 8 ? raceTrait : 0);
    if (ownElement === 2) damageAmp *= 1 + levelValue([0.08, 0.16, 0.28], elementTrait);
    if (ownElement === 4) {
      manaGain *= 1 + levelValue([0.12, 0.24, 0.4], elementTrait);
      healAmp *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
    }
    if (ownElement === 8) {
      hp *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
      resist *= 1 + levelValue([0.08, 0.16, 0.26], elementTrait);
    }
    if (ownElement === 16) {
      shield += hp * levelValue([0.1, 0.2], elementTrait);
      healAmp *= 1 + levelValue([0.1, 0.2], elementTrait);
    }
    if (ownElement === 32) {
      crit += levelValue([0.1, 0.2], elementTrait);
      lifesteal += levelValue([0.08, 0.15], elementTrait);
    }
    if (role === "berserker") damageAmp *= 1 + levelValue([0.15, 0.3], roleTrait);
    if (role === "assassin") crit += levelValue([0.18, 0.38], roleTrait);
    if (role === "ranger") {
      speed *= 1 + levelValue([0.18, 0.38], roleTrait);
      range += levelValue([0.35, 0.75], roleTrait);
    }
    if (role === "arcanist") damageAmp *= 1 + levelValue([0.15, 0.32], roleTrait);
    if (role === "warlock") skillAmp *= 1 + levelValue([0.12, 0.28], roleTrait);
    if (role === "priest") healAmp *= 1 + levelValue([0.22, 0.45], roleTrait);
    if (role === "warden") {
      armor *= 1 + levelValue([0.2, 0.42], roleTrait);
      resist *= 1 + levelValue([0.2, 0.42], roleTrait);
    }
    if (role === "templar") shield += hp * levelValue([0.12, 0.25], roleTrait);
    for (const item of unit.items) {
      if (item === "godslayer_blade") attack *= 1.18;
      if (item === "sage_staff") {
        magic *= 1.18;
        healAmp *= 1.18;
      }
      if (item === "giant_belt") hp *= 1.18;
      if (item === "mithril_plate") {
        armor *= 1.18;
        resist *= 1.18;
      }
      if (item === "gale_boots") speed *= 1.15;
      if (item === "crit_claw") {
        crit += 0.15;
        critDamage += 0.2;
      }
      if (item === "holy_charm") healAmp *= 1.25;
      if (item === "mana_core") mana += 30;
      if (item === "vampire_fang") lifesteal += 0.15;
    }
    if (input.augments.includes("healthy_body")) hp *= 1.08;
    if (input.augments.includes("swift_tactics")) speed *= 1.08;
    if (input.augments.includes("critical_lesson")) crit += 0.1;
    if (input.augments.includes("holy_word")) healAmp *= 1.2;
    if (input.augments.includes("crafted_barrier")) shield += hp * 0.12;
    if (input.augments.includes("mana_spring")) mana += 20;
    hp *= costScale * powerBonus;
    attack *= costScale * powerBonus;
    magic *= costScale * powerBonus;
    const runtime = {
      id: id++,
      side,
      champion,
      sourceUid: unit.uid,
      star: unit.star,
      x,
      y,
      hp,
      maxHp: hp,
      shield,
      mana: Math.min(mana, 100),
      manaMax: role === "priest" || role === "arcanist" ? 88 : role === "warlock" ? 96 : 104,
      attack,
      magic,
      armor,
      resist,
      range,
      speed,
      moveSpeed: 1.15 + shape.agility * 0.32,
      critChance: clamp(crit, 0.02, 0.86),
      critDamage,
      dodge: clamp(dodge, 0.01, 0.68),
      lifesteal,
      manaGain,
      damageAmp,
      skillAmp,
      healAmp,
      elementBonus: 0,
      counterBonus: input.augments.includes("elemental_attune") ? 0.1 : 0,
      attackTimer: 0.2 + Math.random() * 0.3,
      attackCount: 0,
      statuses: [],
      dead: false,
      reviveUsed: false,
      items: unit.items.slice(),
      castingUntil: 0,
      deathsPrevented: 0,
      powerBonus,
      roleTrait,
      executioner: input.augments.includes("executioner"),
      lastStand: input.augments.includes("last_stand") && Boolean(input.lowHp)
    };
    return runtime;
  });
  return { units, nextId: id };
}
function snapshot(units, t) {
  return {
    t,
    units: units.map((u) => ({
      id: u.id,
      x: Number(u.x.toFixed(3)),
      y: Number(u.y.toFixed(3)),
      hp: Math.max(0, Math.round(u.hp)),
      maxHp: Math.round(u.maxHp),
      mana: Math.round(u.mana),
      shield: Math.round(u.shield),
      alive: !u.dead,
      casting: u.castingUntil > t
    }))
  };
}
function hasStatus(unit, kinds) {
  return unit.statuses.some((s) => kinds.includes(s.kind) && s.remaining > 0);
}
function addStatus(unit, kind, duration, power, source, events, t) {
  const existing = unit.statuses.find((s) => s.kind === kind);
  if (existing) {
    existing.remaining = Math.max(existing.remaining, duration);
    existing.power = Math.max(existing.power, power);
  } else {
    unit.statuses.push({ kind, remaining: duration, power, source });
  }
  events.push({ t, type: "status", source, target: unit.id, text: kind, x: unit.x, y: unit.y });
}
function statusSpeedMultiplier(unit) {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "slow") mult *= Math.max(0.35, 1 - status.power);
    if (status.kind === "speedUp") mult *= 1 + status.power;
  }
  return mult;
}
function statusDamageMultiplier(unit) {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "attackUp") mult *= 1 + status.power;
    if (status.kind === "attackDown") mult *= Math.max(0.4, 1 - status.power);
  }
  return mult;
}
function statusDefenseMultiplier(unit) {
  let mult = 1;
  for (const status of unit.statuses) {
    if (status.remaining <= 0) continue;
    if (status.kind === "defenseUp") mult *= 1 + status.power;
    if (status.kind === "resistDown") mult *= Math.max(0.45, 1 - status.power);
  }
  return mult;
}
function killOrRevive(unit, events, t) {
  if (!unit.dead && unit.items.includes("rebirth_feather") && !unit.reviveUsed) {
    unit.reviveUsed = true;
    unit.deathsPrevented += 1;
    unit.hp = unit.maxHp * 0.3;
    unit.shield = unit.maxHp * 0.12;
    events.push({ t, type: "heal", target: unit.id, amount: Math.round(unit.hp), text: "\u590D\u6D3B", x: unit.x, y: unit.y });
    return;
  }
  if (!unit.dead) {
    unit.dead = true;
    unit.hp = 0;
    events.push({ t, type: "death", target: unit.id, x: unit.x, y: unit.y });
  }
}
function dealDamage(source, target, rawAmount, damageType, events, t, damageDealt, healingDone, elementBit = 0) {
  if (target.dead || rawAmount <= 0) return 0;
  let amount = rawAmount;
  if (source) {
    amount *= source.damageAmp * statusDamageMultiplier(source);
    if (source.executioner && target.hp / target.maxHp < 0.3) amount *= 1.15;
    if (source.lastStand) amount *= 1.12;
  }
  if (damageType !== "true") {
    const defense = damageType === "physical" ? target.armor : target.resist;
    amount *= 100 / (100 + Math.max(0, defense * statusDefenseMultiplier(target)));
  }
  if (source && elementBit) {
    amount *= elementMultiplier(elementBit, primaryElement(target.champion.elementMask), source.counterBonus);
  }
  amount = Math.max(1, amount);
  let remaining = amount;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, remaining);
    target.shield -= absorbed;
    remaining -= absorbed;
  }
  target.hp -= remaining;
  const total = amount;
  if (source) {
    damageDealt[source.id] = (damageDealt[source.id] ?? 0) + total;
    source.mana = Math.min(source.manaMax, source.mana + 4 * source.manaGain);
    if (source.lifesteal > 0 && !source.dead) {
      const healed = Math.min(source.maxHp - source.hp, total * source.lifesteal);
      if (healed > 1) {
        source.hp += healed;
        healingDone[source.id] = (healingDone[source.id] ?? 0) + healed;
      }
    }
  }
  target.mana = Math.min(target.manaMax, target.mana + Math.min(18, total / target.maxHp * 48) * target.manaGain);
  events.push({
    t,
    type: "damage",
    source: source?.id,
    target: target.id,
    amount: Math.round(total),
    x: target.x,
    y: target.y
  });
  if (target.hp <= 0) {
    killOrRevive(target, events, t);
    if (target.dead && source && !source.dead && source.champion.role === "berserker" && source.roleTrait > 0) {
      const recovered = Math.min(source.maxHp - source.hp, source.maxHp * levelValue([0.12, 0.25], source.roleTrait));
      if (recovered > 1) {
        source.hp += recovered;
        healingDone[source.id] = (healingDone[source.id] ?? 0) + recovered;
        events.push({ t, type: "heal", source: source.id, target: source.id, amount: Math.round(recovered), text: "\u65A9\u6740\u56DE\u590D", x: source.x, y: source.y });
      }
    }
  }
  return total;
}
function healUnit(source, target, amount, events, t, healingDone) {
  if (target.dead || amount <= 0) return;
  const final = amount * source.healAmp;
  const healed = Math.min(target.maxHp - target.hp, final);
  if (healed <= 1) return;
  target.hp += healed;
  healingDone[source.id] = (healingDone[source.id] ?? 0) + healed;
  events.push({ t, type: "heal", source: source.id, target: target.id, amount: Math.round(healed), x: target.x, y: target.y });
}
function shieldUnit(source, target, amount, events, t) {
  if (target.dead || amount <= 0) return;
  const final = amount * source.healAmp;
  target.shield = Math.min(target.maxHp * 0.75, target.shield + final);
  events.push({ t, type: "shield", source: source.id, target: target.id, amount: Math.round(final), x: target.x, y: target.y });
}
function nearestEnemy(unit, enemies) {
  let best = null;
  let bestScore = Infinity;
  const taunters = enemies.filter((e) => !e.dead && (e.champion.role === "warden" || e.champion.role === "templar") && distance(unit, e) < 2.4);
  const candidates = taunters.length && unit.champion.role !== "assassin" ? taunters : enemies.filter((e) => !e.dead);
  for (const enemy of candidates) {
    let score = distance(unit, enemy);
    if (unit.champion.role === "assassin") {
      const backlineBias = unit.side === "player" ? -enemy.y * 0.08 : enemy.y * 0.08;
      score += backlineBias + enemy.hp / enemy.maxHp * 0.25;
    }
    if (score < bestScore) {
      bestScore = score;
      best = enemy;
    }
  }
  return best;
}
function enemiesInRadius(center, enemies, radius) {
  return enemies.filter((e) => !e.dead && Math.hypot(e.x - center.x, e.y - center.y) <= radius);
}
function applyElementalAilment(source, target, events, t, strong) {
  const element = primaryElement(source.champion.elementMask);
  const duration = strong ? 3.2 : 1.8;
  if (element === 2) addStatus(target, "burn", duration, 0.018 * target.maxHp, source.id, events, t);
  else if (element === 4) addStatus(target, "slow", duration, strong ? 0.34 : 0.2, source.id, events, t);
  else if (element === 8) addStatus(target, "poison", duration + 1, 0.014 * target.maxHp, source.id, events, t);
  else if (element === 16) addStatus(target, "silence", strong ? 2.2 : 1.25, 1, source.id, events, t);
  else if (element === 32) addStatus(target, "stun", strong ? 1.25 : 0.7, 1, source.id, events, t);
  else addStatus(target, "resistDown", duration, strong ? 0.22 : 0.12, source.id, events, t);
}
function skillText(champion) {
  return `${champion.skill.description ?? ""}
${champion.skill.characterDetail ?? ""}`.replace(/<[^>]+>/g, "");
}
function hitsAllEnemies(champion) {
  const text = skillText(champion);
  return champion.skill.target === "allEnemies" || /攻击全体敌人|给予敌方全体|付与敌方全体|对敌方全体造成伤害|敌方全体威力/.test(text);
}
function healsAllAllies(champion) {
  const text = skillText(champion);
  return /恢复己方全体|回复己方全体|为己方全体.*恢复|恢复最大HP/.test(text) || champion.skill.kind === "heal" && champion.skill.target === "allAllies";
}
function healsSelfOnly(champion) {
  return /恢复自身最大HP/.test(skillText(champion));
}
function normalizeSkillText(text) {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 65248));
}
function parsedEnemyCount(text, fallback) {
  const normalized = normalizeSkillText(text);
  const patterns = [
    /(?:敌方|敌人)(?:各)?(\d+)[名位]/,
    /(\d+)[名位](?:敌人|敌方)/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return clamp(Number(match[1]) || fallback, 1, 6);
  }
  return fallback;
}
function uniqueUnits(units) {
  return Array.from(new Map(units.map((unit) => [unit.id, unit])).values());
}
function selectSkillTargets(caster, target, liveEnemies, allEnemyStrike, t) {
  const skill = caster.champion.skill;
  const text = normalizeSkillText(skillText(caster.champion));
  if (allEnemyStrike) return liveEnemies;
  if (!liveEnemies.length) return [];
  const byDistance = liveEnemies.slice().sort((a, b) => distance(caster, a) - distance(caster, b));
  const farthest = liveEnemies.slice().sort((a, b) => distance(caster, b) - distance(caster, a));
  const lowestHp = liveEnemies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  const highestHp = liveEnemies.slice().sort((a, b) => b.hp / b.maxHp - a.hp / a.maxHp);
  const highestOffense = liveEnemies.slice().sort((a, b) => Math.max(b.attack, b.magic) - Math.max(a.attack, a.magic));
  const requested = parsedEnemyCount(text, skill.target === "single" ? 1 : skill.damage > 190 ? 2 : 1);
  if (/最近与最远|最近.*最远/.test(text)) {
    return uniqueUnits(byDistance.slice(0, requested).concat(farthest.slice(0, requested))).slice(0, requested * 2);
  }
  if (/HP低|低HP/.test(text)) return lowestHp.slice(0, requested);
  if (/HP高/.test(text)) return highestHp.slice(0, requested);
  if (/物理攻击|魔法攻击|攻击最高/.test(text)) return highestOffense.slice(0, requested);
  if (/最远|远方|远处/.test(text)) return farthest.slice(0, Math.max(2, requested));
  if (/随机/.test(text)) {
    return liveEnemies.slice().sort((a, b) => (a.id * 31 + Math.floor(t * 10)) % 17 - (b.id * 31 + Math.floor(t * 10)) % 17).slice(0, requested);
  }
  if (skill.target === "splash" && target) {
    return enemiesInRadius(target, liveEnemies, 1.65).slice(0, Math.max(3, requested));
  }
  if (skill.target === "single") return target ? [target] : [];
  if (skill.target === "nearest" && target) return byDistance.slice(0, requested);
  return target ? [target] : [];
}
function castSkill(caster, target, allies, enemies, events, t, damageDealt, healingDone) {
  const skill = caster.champion.skill;
  caster.mana = 0;
  caster.castingUntil = t + 0.55;
  events.push({
    t,
    type: "skill",
    source: caster.id,
    target: target?.id,
    text: skill.name,
    x: caster.x,
    y: caster.y,
    x2: target?.x,
    y2: target?.y
  });
  const physical = isPhysical(caster.champion);
  const baseOffense = physical ? caster.attack : caster.magic;
  const skillPower = Math.max(35, skill.damage);
  const damageRatio = (0.62 + skillPower / 145) * caster.skillAmp;
  const healRatio = (0.8 + Math.max(20, skill.heal) / 95) * caster.skillAmp;
  const hits = clamp(skill.hits || 1, 1, 6);
  const element = primaryElement(caster.champion.elementMask);
  const type = physical ? "physical" : "magic";
  const liveEnemies = enemies.filter((e) => !e.dead);
  const liveAllies = allies.filter((a) => !a.dead);
  const allEnemyStrike = hitsAllEnemies(caster.champion);
  const targets = selectSkillTargets(caster, target, liveEnemies, allEnemyStrike, t);
  const doesDamage = ["damage", "burst", "burstControl", "hybrid"].includes(skill.kind) || skill.damage >= 60;
  const doesHeal = ["heal", "hybrid"].includes(skill.kind) || skill.heal >= 35;
  const doesShield = skill.kind === "shield" || skillText(caster.champion).includes("\u62A4\u76FE");
  const doesBuff = skill.kind === "buff" || skill.buff >= 25;
  const doesControl = skill.kind === "control" || skill.kind === "burstControl" || skill.ailmentCount >= 4;
  if (doesDamage && targets.length) {
    const targetPenalty = targets.length > 1 ? 0.76 : 1;
    for (const victim of targets) {
      let total = 0;
      for (let hit = 0; hit < hits; hit++) {
        total += baseOffense * damageRatio * targetPenalty / hits;
      }
      dealDamage(caster, victim, total, type, events, t, damageDealt, healingDone, element);
      if (doesControl && !victim.dead) applyElementalAilment(caster, victim, events, t, skill.ailmentCount >= 5 || skill.debuff > 25);
    }
  }
  const explicitAllAllyHeal = healsAllAllies(caster.champion);
  const explicitSelfHeal = healsSelfOnly(caster.champion);
  const detailText = skillText(caster.champion).trim();
  const vagueHybridHeal = skill.kind === "hybrid" && skill.heal >= 45 && (!detailText || /恢复|回复|HP/i.test(detailText));
  const directHeal = explicitAllAllyHeal || explicitSelfHeal || skill.kind === "heal" || vagueHybridHeal;
  if (directHeal) {
    const usesMaxHpPercent = explicitAllAllyHeal || explicitSelfHeal;
    const directRatio = healRatio;
    const healTargets = explicitSelfHeal ? [caster] : explicitAllAllyHeal || skill.target === "allAllies" ? liveAllies : liveAllies.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp).slice(0, skill.kind === "heal" ? 3 : 2);
    for (const ally of healTargets) {
      const amount = usesMaxHpPercent ? ally.maxHp * clamp(skill.heal, 5, 35) / 100 : caster.magic * directRatio;
      healUnit(caster, ally, amount, events, t, healingDone);
    }
  }
  if (doesShield) {
    const shieldTargets = skill.target === "self" ? [caster] : liveAllies;
    for (const ally of shieldTargets) shieldUnit(caster, ally, caster.maxHp * (0.1 + skill.buff / 300) + caster.magic * 0.35, events, t);
  }
  if (doesBuff) {
    for (const ally of liveAllies) {
      const kind = physical ? "attackUp" : "speedUp";
      addStatus(ally, kind, 5.5, 0.1 + Math.min(0.28, skill.buff / 220), caster.id, events, t);
      if (skill.buff > 45) addStatus(ally, "defenseUp", 5.5, 0.12, caster.id, events, t);
    }
  }
  if (doesControl && !doesDamage && target) {
    const controlTargets = hitsAllEnemies(caster.champion) ? liveEnemies.slice(0, 4) : [target];
    for (const victim of controlTargets) {
      dealDamage(caster, victim, baseOffense * 0.7 * caster.skillAmp, type, events, t, damageDealt, healingDone, element);
      if (!victim.dead) applyElementalAilment(caster, victim, events, t, true);
    }
  }
}
function moveToward(unit, target, dt, units) {
  const dx = target.x - unit.x;
  const dy = target.y - unit.y;
  const dist = Math.max(1e-3, Math.hypot(dx, dy));
  const step = Math.min(dist - unit.range * 0.82, unit.moveSpeed * statusSpeedMultiplier(unit) * dt);
  if (step <= 0) return;
  unit.x += dx / dist * step;
  unit.y += dy / dist * step;
  unit.x = clamp(unit.x, 0.15, 7.65);
  unit.y = clamp(unit.y, 0.15, 7.65);
  for (const other of units) {
    if (other === unit || other.dead) continue;
    const ox = unit.x - other.x;
    const oy = unit.y - other.y;
    const d = Math.hypot(ox, oy);
    if (d > 1e-3 && d < 0.56) {
      unit.x += ox / d * (0.56 - d) * 0.35;
      unit.y += oy / d * (0.56 - d) * 0.35;
    }
  }
}
function applyOpeningAssassinMoves(playerUnits, enemyUnits) {
  for (const assassin of playerUnits.concat(enemyUnits)) {
    if (assassin.champion.role !== "assassin" || assassin.roleTrait <= 0) continue;
    const foes = assassin.side === "player" ? enemyUnits : playerUnits;
    const candidates = foes.filter((u) => ["arcanist", "warlock", "priest", "ranger"].includes(u.champion.role) && !u.dead);
    const target = (candidates.length ? candidates : foes).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    if (!target) continue;
    assassin.x = clamp(target.x + (assassin.side === "player" ? -0.25 : 0.25), 0.3, 7.5);
    assassin.y = clamp(target.y + (assassin.side === "player" ? -0.65 : 0.65), 0.3, 7.5);
  }
}
function applyOpeningAuras(playerUnits, enemyUnits, playerInput, enemyInput) {
  const pairs = [
    [playerUnits, enemyUnits, playerInput],
    [enemyUnits, playerUnits, enemyInput]
  ];
  for (const [allies, foes, input] of pairs) {
    const warlockLevel = input.traits.roles.warlock ?? 0;
    const resistCut = levelValue([0.08, 0.16], warlockLevel);
    if (resistCut > 0 && allies.some((u) => u.champion.role === "warlock")) {
      for (const foe of foes) foe.resist *= Math.max(0.55, 1 - resistCut);
    }
  }
}
function simulateCombat(playerInput, enemyInput, seed) {
  const rng = mulberry32(seed);
  const playerMade = makeRuntimeUnits("player", playerInput, 1);
  const enemyMade = makeRuntimeUnits("enemy", enemyInput, playerMade.nextId);
  const playerUnits = playerMade.units;
  const enemyUnits = enemyMade.units;
  const units = playerUnits.concat(enemyUnits);
  const labels = {};
  for (const unit of units) {
    labels[unit.id] = {
      championId: unit.champion.id,
      side: unit.side,
      star: unit.star,
      name: unit.champion.name
    };
  }
  applyOpeningAuras(playerUnits, enemyUnits, playerInput, enemyInput);
  applyOpeningAssassinMoves(playerUnits, enemyUnits);
  const events = [];
  const frames = [];
  const damageDealt = {};
  const healingDone = {};
  const dt = 0.2;
  const maxDuration = 46;
  let winner = "draw";
  let t = 0;
  frames.push(snapshot(units, 0));
  for (t = dt; t <= maxDuration; t += dt) {
    const fatigue = t > 32 ? 1 + (t - 32) * 0.045 : 1;
    for (const unit of units) {
      if (unit.dead) continue;
      for (const status of unit.statuses) {
        if (status.remaining <= 0) continue;
        status.remaining -= dt;
        if ((status.kind === "burn" || status.kind === "poison") && status.power > 0) {
          const owner = units.find((u) => u.id === status.source) ?? null;
          dealDamage(owner, unit, status.power * dt * fatigue, "true", events, t, damageDealt, healingDone);
        }
      }
      unit.statuses = unit.statuses.filter((s) => s.remaining > -0.2);
      if (unit.dead) continue;
      const allies = unit.side === "player" ? playerUnits : enemyUnits;
      const enemies = unit.side === "player" ? enemyUnits : playerUnits;
      const target = nearestEnemy(unit, enemies);
      if (!target) continue;
      const disabled = hasStatus(unit, ["stun", "freeze"]);
      const silenced = hasStatus(unit, ["silence"]);
      if (!disabled && unit.mana >= unit.manaMax && !silenced) {
        castSkill(unit, target, allies, enemies, events, t, damageDealt, healingDone);
        continue;
      }
      const dist = distance(unit, target);
      if (dist > unit.range) {
        if (!disabled) moveToward(unit, target, dt, units);
      } else if (!disabled) {
        unit.attackTimer -= dt * statusSpeedMultiplier(unit) * unit.speed;
        if (unit.attackTimer <= 0) {
          unit.attackTimer = 1;
          unit.attackCount += 1;
          const physical = isPhysical(unit.champion);
          const attackValue = physical ? unit.attack : unit.magic;
          const hitRoll = rng();
          const dodged = hitRoll < target.dodge * (unit.champion.role === "ranger" ? 0.75 : 1);
          events.push({ t, type: "attack", source: unit.id, target: target.id, x: unit.x, y: unit.y, x2: target.x, y2: target.y });
          if (!dodged) {
            const crit = rng() < unit.critChance;
            const raw = attackValue * (crit ? unit.critDamage : 1) * fatigue;
            const dealt = dealDamage(unit, target, raw, physical ? "physical" : "magic", events, t, damageDealt, healingDone, primaryElement(unit.champion.elementMask));
            unit.mana = Math.min(unit.manaMax, unit.mana + 12 * unit.manaGain);
            if (unit.items.includes("frost_sigil")) addStatus(target, "slow", 2, 0.12, unit.id, events, t);
            if (unit.items.includes("thunder_hammer") && unit.attackCount % 3 === 0) {
              const splashTargets = enemiesInRadius(target, enemies, 1.25).filter((e) => e.id !== target.id).slice(0, 2);
              for (const splash of splashTargets) dealDamage(unit, splash, dealt * 0.35, physical ? "physical" : "magic", events, t, damageDealt, healingDone, primaryElement(unit.champion.elementMask));
            }
            if (crit) events.push({ t, type: "damage", source: unit.id, target: target.id, text: "\u66B4\u51FB", x: target.x, y: target.y });
          } else {
            events.push({ t, type: "damage", source: unit.id, target: target.id, text: "\u95EA\u907F", x: target.x, y: target.y });
          }
        }
      }
    }
    frames.push(snapshot(units, t));
    const playerAlive = playerUnits.some((u) => !u.dead);
    const enemyAlive = enemyUnits.some((u) => !u.dead);
    if (!playerAlive || !enemyAlive) {
      if (playerAlive && !enemyAlive) winner = "player";
      else if (!playerAlive && enemyAlive) winner = "enemy";
      else winner = "draw";
      break;
    }
  }
  if (!playerUnits.some((u) => !u.dead) && enemyUnits.some((u) => !u.dead)) winner = "enemy";
  else if (playerUnits.some((u) => !u.dead) && !enemyUnits.some((u) => !u.dead)) winner = "player";
  else if (winner === "draw") {
    const playerHpPct = playerUnits.reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
    const enemyHpPct = enemyUnits.reduce((sum, u) => sum + Math.max(0, u.hp) / u.maxHp, 0);
    if (Math.abs(playerHpPct - enemyHpPct) > 0.12) winner = playerHpPct > enemyHpPct ? "player" : "enemy";
  }
  const duration = Math.min(t, maxDuration);
  events.push({ t: duration, type: "result", text: winner });
  return {
    winner,
    duration,
    survivingPlayer: playerUnits.filter((u) => !u.dead).reduce((sum, u) => sum + u.hp / u.maxHp, 0),
    survivingEnemy: enemyUnits.filter((u) => !u.dead).reduce((sum, u) => sum + u.hp / u.maxHp, 0),
    playerUnitsLeft: playerUnits.filter((u) => !u.dead).length,
    enemyUnitsLeft: enemyUnits.filter((u) => !u.dead).length,
    frames,
    events,
    unitLabels: labels,
    damageDealt,
    healingDone
  };
}

// src/game/synergies.ts
function uniqueBoardChampions(player, champions2) {
  const seen = /* @__PURE__ */ new Set();
  const result = [];
  for (const unit of Object.values(player.board)) {
    if (seen.has(unit.championId)) continue;
    const champion = champions2.get(unit.championId);
    if (!champion) continue;
    seen.add(unit.championId);
    result.push(champion);
  }
  return result;
}
function activeLevel(count, breakpoints) {
  let level = 0;
  for (const point of breakpoints) if (count >= point) level += 1;
  return level;
}
function combatTraitLevels(player, champions2) {
  const board = uniqueBoardChampions(player, champions2);
  const raceCounts = /* @__PURE__ */ new Map();
  const roleCounts = /* @__PURE__ */ new Map();
  const elementCounts = /* @__PURE__ */ new Map();
  for (const champion of board) {
    raceCounts.set(champion.race, (raceCounts.get(champion.race) ?? 0) + 1);
    roleCounts.set(champion.role, (roleCounts.get(champion.role) ?? 0) + 1);
    const element = primaryElement(champion.elementMask);
    if (element !== 1 && element !== 64) elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
  }
  const races = {};
  const roles = {};
  const elements = {};
  for (const def of RACE_TRAITS) races[def.race] = activeLevel(raceCounts.get(def.race) ?? 0, def.breakpoints);
  for (const def of ROLE_TRAITS) roles[def.role] = activeLevel(roleCounts.get(def.role) ?? 0, def.breakpoints);
  for (const def of ELEMENT_TRAITS) elements[def.element] = activeLevel(elementCounts.get(def.element) ?? 0, def.breakpoints);
  return { races, roles, elements };
}

// src/game/engine.ts
function clone(value) {
  return structuredClone(value);
}
function human(state2) {
  return state2.players[0];
}
function pushLog(state2, message) {
  state2.log.unshift(message);
  state2.log = state2.log.slice(0, 90);
}
function roundType(round, mode2 = "pve") {
  return mode2 === "trial" || round <= 2 || round % 5 === 0 ? "pve" : "pvp";
}
function incomeFor(player) {
  const interestCap = player.augments.includes("gold_flow") ? 7 : 5;
  const interest = Math.min(interestCap, Math.floor(player.gold / 10));
  const streak = winStreakGoldBonus(player.winStreak) + lossStreakGoldBonus(player.lossStreak);
  return 5 + interest + streak + (player.augments.includes("gold_flow") ? 1 : 0);
}
function returnShopToPool(state2, player) {
  for (const slot of player.shop) {
    if (slot.championId && !slot.sold) refundPool(state2.pool, slot.championId, 1);
  }
}
function activeChampions(store2, state2) {
  return state2.activeRoster.map((id) => store2.champions.get(id)).filter((c) => Boolean(c));
}
function createInitialState(store2, seed = Date.now() % 1e9, mode2 = "pve") {
  resetUid(seed);
  const rng = mulberry32(seed);
  const active = mode2 === "chaos" ? store2.dataset.characters.filter((c) => c.assets.hasIcon) : store2.season1.length >= 60 ? store2.season1 : store2.dataset.characters.filter((c) => c.season1);
  const activeRoster = active.map((c) => c.id);
  const state2 = {
    phase: "planning",
    mode: mode2,
    seed,
    round: 1,
    players: [createEmptyPlayer(0, "\u4F60", true)],
    pool: createPool(active),
    activeRoster,
    combat: null,
    pendingAugment: null,
    pendingItem: null,
    log: [],
    combatSpeed: 1,
    roundType: roundType(1, mode2),
    rngCursor: 1
  };
  if (mode2 !== "trial") {
    state2.players.push(...createBots(7, rng));
    for (const bot of state2.players.slice(1)) runBotTurn(bot, state2.pool, active, store2.champions, rng, 1);
  }
  human(state2).shop = rollShop(human(state2), state2.pool, active, rng);
  pushLog(state2, mode2 === "trial" ? "\u4E16\u754C\u6811\u8BD5\u70BC\u5F00\u542F\u3002\u5728 20 \u8F6E\u8FDE\u7EED\u8BD5\u70BC\u4E2D\u6D3B\u4E0B\u6765\u3002\u7B2C 1 \u56DE\u5408\uFF1A\u6574\u5907\u9636\u6BB5\u3002" : mode2 === "chaos" ? "\u5168\u82F1\u7075\u6DF7\u6218\u5F00\u542F\uFF1A985 \u540D\u89D2\u8272\u8FDB\u5165\u6DF7\u6C8C\u5361\u6C60\uFF0C\u4E0E 7 \u540D AI \u6307\u6325\u5B98\u4E89\u593A\u80DC\u5229\u3002\u7B2C 1 \u56DE\u5408\uFF1A\u6574\u5907\u9636\u6BB5\u3002" : "\u5355\u673A\u68CB\u5883\u5F00\u542F\uFF1A\u4E0E 7 \u540D AI \u6307\u6325\u5B98\u4E89\u593A\u6700\u7EC8\u80DC\u5229\u3002\u7B2C 1 \u56DE\u5408\uFF1A\u6574\u5907\u9636\u6BB5\u3002");
  return state2;
}
function rerollCost(player) {
  return player.augments.includes("cheap_refresh") ? 1 : 2;
}
function levelUp(player, amount) {
  const messages = [];
  player.xp += amount;
  while (player.level < 9) {
    const need = XP_TO_NEXT[player.level] ?? 999;
    if (player.xp < need) break;
    player.xp -= need;
    player.level += 1;
    messages.push(`\u7B49\u7EA7\u63D0\u5347\u5230 ${player.level}\uFF0C\u4E0A\u9635\u4E0A\u9650 ${deployLimit(player)}`);
  }
  return messages;
}
function entriesFromPlayer(player, champions2, side) {
  const entries = [];
  for (const [key, unit] of Object.entries(player.board)) {
    const [x, localY] = key.split(",").map(Number);
    const champion = champions2.get(unit.championId);
    if (!champion) continue;
    entries.push({
      unit,
      champion,
      x,
      y: side === "player" ? 4 + localY : 3 - localY
    });
  }
  return entries;
}
function inputFromPlayer(player, champions2, side, powerBonus = 1) {
  return {
    entries: entriesFromPlayer(player, champions2, side),
    traits: combatTraitLevels(player, champions2),
    augments: player.augments,
    powerBonus,
    lowHp: player.isHuman && player.hp <= 35
  };
}
function makePveInput(store2, roster, round, rng, trialMode = false) {
  const thematic = roster.filter((c) => [6, 7].includes(c.race));
  const fallback = roster.filter((c) => c.cost <= Math.min(5, 1 + Math.ceil(round / 4)));
  const candidates = thematic.length >= 8 ? thematic : fallback;
  const count = Math.min(7, 1 + Math.floor((round + 1) / 4));
  const entries = [];
  const used = /* @__PURE__ */ new Set();
  for (let i = 0; i < count; i++) {
    const pool = candidates.filter((c) => !used.has(c.id) && c.cost <= Math.min(5, 1 + Math.ceil(round / 5)));
    const champion = pool.length ? pickOne(rng, pool) : pickOne(rng, candidates);
    used.add(champion.id);
    const star = round >= 15 && i < 2 ? 3 : round >= 7 && i < 2 ? 2 : 1;
    const itemCount = round >= 10 && i < 2 ? 1 : 0;
    const unit = makeUnit(champion.id, star, shuffle(rng, ITEMS.filter((item) => item.id !== "hero_duplicator")).slice(0, itemCount).map((item) => item.id));
    entries.push({
      unit,
      champion,
      x: 1 + i * 1.35 % 6,
      y: 3 - i % 3
    });
  }
  return {
    entries,
    traits: { races: {}, roles: {}, elements: {} },
    augments: [],
    powerBonus: trialMode ? 0.69 + round * 0.041 : 0.66 + round * 0.025
  };
}
function beginCombat(state2, store2) {
  const me = human(state2);
  if (!boardCount(me)) {
    pushLog(state2, "\u81F3\u5C11\u4E0A\u9635 1 \u4E2A\u68CB\u5B50\u624D\u80FD\u5F00\u59CB\u6218\u6597\u3002");
    return;
  }
  const rng = mulberry32(state2.seed + state2.round * 7919);
  const roster = activeChampions(store2, state2);
  const type = state2.roundType;
  let opponentId = -1;
  let opponentName = "\u4E16\u754C\u6811\u8BD5\u70BC";
  let enemyInput;
  if (type === "pve") {
    enemyInput = makePveInput(store2, roster, state2.round, rng, state2.mode === "trial");
  } else {
    const opponent = chooseHumanOpponent(state2.players, rng);
    if (!opponent) {
      pushLog(state2, "\u6CA1\u6709\u53EF\u6311\u6218\u7684\u5BF9\u624B\u3002");
      return;
    }
    opponentId = opponent.id;
    opponentName = opponent.name;
    me.lastOpponentId = opponent.id;
    enemyInput = inputFromPlayer(opponent, store2.champions, "enemy", opponent.botPowerBonus);
  }
  const playerInput = inputFromPlayer(me, store2.champions, "player", 1);
  const result = simulateCombat(playerInput, enemyInput, state2.seed + state2.round * 131071 + (type === "pve" ? 17 : 0));
  const combat = {
    round: state2.round,
    roundType: type,
    opponentId,
    opponentName,
    result,
    startedAt: performance.now()
  };
  state2.combat = combat;
  state2.phase = "combat";
  pushLog(state2, `\u7B2C ${state2.round} \u56DE\u5408\u6218\u6597\u5F00\u59CB\uFF1A${type === "pve" ? "\u4E16\u754C\u6811\u8BD5\u70BC" : `\u5BF9\u9635 ${opponentName}`}`);
}
function playerDamageFor(round, unitsLeft, survivingPct) {
  return Math.max(1, Math.round(2 + round * 0.48 + unitsLeft * 1.35 + survivingPct * 2.2));
}
function applyPostCombatEconomy(state2, store2) {
  const rng = mulberry32(state2.seed + state2.round * 31337 + 77);
  const messages = resolveBotBattles(state2.players, store2.champions, rng, state2.round, state2.combat?.opponentId);
  for (const message of messages) pushLog(state2, message);
  for (const player of state2.players) {
    if (!player.alive) continue;
    player.gold += incomeFor(player);
  }
  const roster = activeChampions(store2, state2);
  for (const bot of state2.players.slice(1)) {
    if (bot.alive) runBotTurn(bot, state2.pool, roster, store2.champions, rng, state2.round + 1);
  }
}
function applyImmediateAugment(state2, player, augmentId) {
  if (augmentId === "golden_injection") player.gold += 12;
  if (augmentId === "fast_training") {
    for (const msg of levelUp(player, 8)) pushLog(state2, msg);
  }
  if (augmentId === "oracle_refresh") player.freeRerolls += 1;
  if (augmentId === "duplicator") {
    player.itemInventory.push("hero_duplicator");
    pushLog(state2, "\u83B7\u5F97\u6D88\u8017\u54C1\u300C\u82F1\u96C4\u590D\u5236\u5668\u300D\uFF1A\u70B9\u51FB\u5B83\uFF0C\u518D\u70B9\u51FB\u4EFB\u610F\u5DF2\u62E5\u6709\u68CB\u5B50\u5373\u53EF\u590D\u5236\u3002");
  }
}
function finishCombat(state2, store2) {
  const combat = state2.combat;
  if (!combat) return;
  const me = human(state2);
  const won = combat.result.winner === "player";
  const draw = combat.result.winner === "draw";
  const opponent = combat.opponentId >= 0 ? state2.players.find((p) => p.id === combat.opponentId) : null;
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
        pushLog(state2, `${opponent.name} \u88AB\u4F60\u5728\u7B2C ${combat.round} \u56DE\u5408\u6DD8\u6C70\u3002`);
      }
    }
    pushLog(state2, `\u7B2C ${combat.round} \u56DE\u5408\u80DC\u5229\uFF1A\u5269\u4F59 ${combat.result.playerUnitsLeft} \u4E2A\u53CB\u519B\u3002`);
  } else if (!draw) {
    me.lossStreak += 1;
    me.winStreak = 0;
    const damage = Math.max(1, Math.round(playerDamageFor(combat.round, combat.result.enemyUnitsLeft, combat.result.survivingEnemy) * (combat.roundType === "pve" ? 0.45 : 1)));
    me.hp = Math.max(0, me.hp - damage);
    pushLog(state2, `\u7B2C ${combat.round} \u56DE\u5408\u6218\u8D25\uFF0C\u53D7\u5230 ${damage} \u70B9\u4F24\u5BB3\u3002`);
    if (opponent) {
      opponent.winStreak += 1;
      opponent.lossStreak = 0;
    }
  } else {
    const damage = Math.max(1, Math.round(playerDamageFor(combat.round, combat.result.enemyUnitsLeft, combat.result.survivingEnemy) * 0.55));
    me.hp = Math.max(0, me.hp - damage);
    pushLog(state2, `\u7B2C ${combat.round} \u56DE\u5408\u8D85\u65F6\u93D6\u6218\uFF0C\u53D7\u5230 ${damage} \u70B9\u4F24\u5BB3\u3002\u8FDE\u80DC/\u8FDE\u8D25\u4E0D\u53D7\u5F71\u54CD\u3002`);
  }
  if (won && combat.roundType === "pvp") {
    if (me.augments.includes("war_treasury")) me.gold += 2;
    const humanRaceLevel = combatTraitLevels(me, store2.champions).races[2] ?? 0;
    if (humanRaceLevel > 0) me.gold += humanRaceLevel;
  }
  applyPostCombatEconomy(state2, store2);
  if (!won && !draw && me.lossStreak >= 2) {
    pushLog(state2, `\u8FDE\u8D25\u8FFD\u8D76\u52A0\u6210\uFF1A\u672C\u56DE\u5408\u8FDE\u8D25\u8865\u8D34 +${lossStreakGoldBonus(me.lossStreak)} \u91D1\u5E01\uFF0C\u540E\u7EED\u795E\u5668/\u7B26\u6587\u5956\u52B1\u54C1\u8D28\u63D0\u5347\u3002`);
  }
  if (me.hp <= 0) {
    me.alive = false;
    me.eliminatedRound = combat.round;
    state2.phase = "gameover";
    state2.gameResult = "defeat";
    pushLog(state2, "\u4F60\u7684\u82F1\u7075\u6BBF\u4E4B\u65C5\u5230\u6B64\u7ED3\u675F\u3002");
    return;
  }
  const completedRound = combat.round;
  if (state2.mode === "trial" && completedRound >= 20) {
    state2.phase = "gameover";
    state2.gameResult = "victory";
    pushLog(state2, "\u4F60\u5B8C\u6210\u4E86 20 \u8F6E\u4E16\u754C\u6811\u8BD5\u70BC\uFF01");
    return;
  }
  if (state2.mode !== "trial") {
    const enemiesAlive = state2.players.some((p) => !p.isHuman && p.alive);
    if (!enemiesAlive) {
      state2.phase = "gameover";
      state2.gameResult = "victory";
      pushLog(state2, "\u6240\u6709\u5BF9\u624B\u90FD\u88AB\u6DD8\u6C70\u3002\u4F60\u8D62\u5F97\u4E86\u5973\u6B66\u795E\u68CB\u5883\uFF01");
      return;
    }
  }
  state2.round = completedRound + 1;
  state2.roundType = roundType(state2.round, state2.mode);
  state2.combat = null;
  const augmentRound = (state2.mode === "trial" ? [3, 8, 13, 18] : [3, 8, 13]).includes(completedRound);
  if (augmentRound) {
    const rng = mulberry32(state2.seed + completedRound * 424243);
    const choices = chooseBalancedAugments(rng, completedRound, me.augments, me.lossStreak).map((a) => a.id);
    if (choices.length) state2.pendingAugment = { choices, round: completedRound };
  }
  const pveItemReward = combat.roundType === "pve" && won;
  const lossItemReward = !won && !draw && me.lossStreak >= 2;
  if (pveItemReward || lossItemReward) {
    const rng = mulberry32(state2.seed + completedRound * 171717);
    state2.pendingItem = { choices: chooseBalancedItems(rng, me.lossStreak).map((item) => item.id), round: completedRound };
  }
  if (state2.pendingItem) {
    state2.phase = "item";
    if (lossItemReward) {
      pushLog(state2, state2.pendingAugment ? `\u8FDE\u8D25\u8865\u7ED9\uFF08${me.lossStreak} \u8FDE\u8D25\uFF09\uFF1A\u9009\u62E9 1 \u4EF6\u9AD8\u54C1\u8D28\u6743\u91CD\u63D0\u5347\u7684\u795E\u5668\uFF0C\u968F\u540E\u9009\u62E9 1 \u4E2A\u5F3A\u5316\u7B26\u6587\u3002` : `\u8FDE\u8D25\u8865\u7ED9\uFF08${me.lossStreak} \u8FDE\u8D25\uFF09\uFF1A\u9009\u62E9 1 \u4EF6\u9AD8\u54C1\u8D28\u6743\u91CD\u63D0\u5347\u7684\u795E\u5668\u3002`);
    } else {
      pushLog(state2, state2.pendingAugment ? "\u8BD5\u70BC\u5956\u52B1\uFF1A\u9009\u62E9 1 \u4EF6\u795E\u5668\uFF0C\u968F\u540E\u9009\u62E9 1 \u4E2A\u5F3A\u5316\u7B26\u6587\u3002" : "\u8BD5\u70BC\u5956\u52B1\uFF1A\u9009\u62E9 1 \u4EF6\u795E\u5668\u3002");
    }
    return;
  }
  if (state2.pendingAugment) {
    state2.phase = "augment";
    pushLog(state2, me.lossStreak >= 2 ? `\u795E\u8C15\u8D50\u798F\u964D\u4E34\uFF1A\u8FDE\u8D25\u8BA9\u4F60\u7684\u9AD8\u9636\u7B26\u6587\u51FA\u73B0\u7387\u63D0\u5347\uFF08\u5F53\u524D ${me.lossStreak} \u8FDE\u8D25\uFF09\u3002` : "\u795E\u8C15\u8D50\u798F\u964D\u4E34\uFF1A\u9009\u62E9 1 \u4E2A\u5F3A\u5316\u7B26\u6587\u3002");
    return;
  }
  state2.phase = "planning";
  if (me.augments.includes("oracle_refresh")) me.freeRerolls = Math.max(me.freeRerolls, 1);
  if (!me.shopLocked) {
    returnShopToPool(state2, me);
    const rng = mulberry32(state2.seed + state2.round * 2718);
    me.shop = rollShop(me, state2.pool, activeChampions(store2, state2), rng);
  }
  pushLog(state2, `\u7B2C ${state2.round} \u56DE\u5408\u6574\u5907\u9636\u6BB5\u5F00\u59CB\u3002`);
}
function buyUnit(state2, store2, slotIndex) {
  const me = human(state2);
  const slot = me.shop[slotIndex];
  if (!slot?.championId) return;
  const champion = store2.champions.get(slot.championId);
  if (!champion) return;
  if (me.gold < champion.cost) {
    pushLog(state2, "\u91D1\u5E01\u4E0D\u8DB3\u3002");
    return;
  }
  const unit = makeUnit(champion.id);
  const added = addUnitToBench(me, unit);
  if (!added.ok) {
    pushLog(state2, added.messages[0] ?? "\u65E0\u6CD5\u8D2D\u4E70\u3002");
    return;
  }
  me.gold -= champion.cost;
  slot.sold = true;
  slot.championId = null;
  pushLog(state2, `\u8D2D\u5165 ${champion.name}\uFF08${champion.cost} \u8D39\uFF09\u3002`);
  for (const message of added.messages) pushLog(state2, `${champion.name} ${message}`);
}
function equipItem(state2, store2, itemIndex, loc) {
  const me = human(state2);
  const itemId = me.itemInventory[itemIndex];
  if (!itemId) return;
  const unit = getUnitAt(me, loc);
  if (!unit) {
    pushLog(state2, "\u8BF7\u9009\u62E9\u4E00\u4E2A\u5DF2\u62E5\u6709\u68CB\u5B50\u6765\u88C5\u5907\u795E\u5668\u3002");
    return;
  }
  if (itemId === "hero_duplicator") {
    const champion = store2.champions.get(unit.championId);
    const copy = makeUnit(unit.championId, unit.star);
    const added = addUnitToBench(me, copy);
    if (!added.ok) {
      pushLog(state2, `\u82F1\u96C4\u590D\u5236\u5668\u4F7F\u7528\u5931\u8D25\uFF1A${added.messages[0] ?? "\u5907\u6218\u5E2D\u5DF2\u6EE1"}`);
      return;
    }
    me.itemInventory.splice(itemIndex, 1);
    pushLog(state2, `\u82F1\u96C4\u590D\u5236\u5668\u590D\u5236\u4E86 ${champion?.name ?? unit.championId}\uFF08\u2605${unit.star}\uFF09\uFF0C\u590D\u5236\u4F53\u5DF2\u653E\u5165\u5907\u6218\u5E2D\u3002`);
    for (const message of added.messages) pushLog(state2, `${champion?.name ?? "\u590D\u5236\u4F53"} ${message}`);
    return;
  }
  if (unit.items.length >= 2) {
    pushLog(state2, "\u8BE5\u68CB\u5B50\u5DF2\u7ECF\u643A\u5E26 2 \u4EF6\u795E\u5668\u3002");
    return;
  }
  me.itemInventory.splice(itemIndex, 1);
  unit.items.push(itemId);
  const item = ITEMS.find((it) => it.id === itemId);
  pushLog(state2, `${item?.name ?? itemId} \u5DF2\u88C5\u5907\u3002`);
}
function reducerWithStore(state2, action, store2) {
  if (action.type === "NEW_GAME") return createInitialState(store2, action.seed, action.mode ?? state2.mode);
  const next = clone(state2);
  const me = human(next);
  next.rngCursor = (next.rngCursor ?? 0) + 1;
  const rng = mulberry32(next.seed + next.round * 977 + next.rngCursor * 314159 + next.players.reduce((s, p) => s + p.gold * 13 + p.level * 31, 0));
  switch (action.type) {
    case "BUY_UNIT":
      if (next.phase === "planning") buyUnit(next, store2, action.slot);
      break;
    case "REROLL": {
      if (next.phase !== "planning") break;
      const free = me.freeRerolls > 0;
      const cost = free ? 0 : rerollCost(me);
      if (me.gold < cost) {
        pushLog(next, "\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u5237\u65B0\u3002");
        break;
      }
      me.gold -= cost;
      if (free) me.freeRerolls -= 1;
      returnShopToPool(next, me);
      me.shop = rollShop(me, next.pool, activeChampions(store2, next), rng);
      pushLog(next, free ? "\u4F7F\u7528\u514D\u8D39\u5237\u65B0\u3002" : `\u82B1\u8D39 ${cost} \u91D1\u5E01\u5237\u65B0\u5546\u5E97\u3002`);
      break;
    }
    case "TOGGLE_LOCK":
      if (next.phase === "planning") {
        me.shopLocked = !me.shopLocked;
        pushLog(next, me.shopLocked ? "\u5546\u5E97\u5DF2\u9501\u5B9A\u3002" : "\u5546\u5E97\u5DF2\u89E3\u9501\u3002");
      }
      break;
    case "BUY_XP": {
      if (next.phase !== "planning") break;
      if (me.gold < 4) {
        pushLog(next, "\u91D1\u5E01\u4E0D\u8DB3\uFF0C\u65E0\u6CD5\u8D2D\u4E70\u7ECF\u9A8C\u3002");
        break;
      }
      me.gold -= 4;
      const amount = 4 + (me.augments.includes("studious") ? 2 : 0);
      const messages = levelUp(me, amount);
      pushLog(next, `\u83B7\u5F97 ${amount} \u70B9\u7ECF\u9A8C\u3002`);
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
      const champion = store2.champions.get(unit.championId);
      if (!champion) break;
      const value = sellValue(champion, unit.star);
      me.gold += value;
      refundPool(next.pool, unit.championId, Math.pow(3, unit.star - 1));
      pushLog(next, `\u51FA\u552E ${champion.name}\uFF0C\u83B7\u5F97 ${value} \u91D1\u5E01\u3002`);
      break;
    }
    case "START_COMBAT":
      if (next.phase === "planning") beginCombat(next, store2);
      break;
    case "COMBAT_FINISHED":
      if (next.phase === "combat") finishCombat(next, store2);
      break;
    case "CHOOSE_AUGMENT": {
      if (next.phase !== "augment" || !next.pendingAugment?.choices.includes(action.id)) break;
      me.augments.push(action.id);
      const augment = AUGMENTS.find((a) => a.id === action.id);
      pushLog(next, `\u83B7\u5F97\u5F3A\u5316\u7B26\u6587\u300C${augment?.name ?? action.id}\u300D\u3002`);
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
        me.shop = rollShop(me, next.pool, activeChampions(store2, next), rng);
      }
      break;
    }
    case "CHOOSE_ITEM": {
      if (next.phase !== "item" || !next.pendingItem?.choices.includes(action.id)) break;
      me.itemInventory.push(action.id);
      const item = ITEMS.find((it) => it.id === action.id);
      pushLog(next, `\u83B7\u5F97\u795E\u5668\u300C${item?.name ?? action.id}\u300D\u3002\u70B9\u51FB\u795E\u5668\u540E\u518D\u70B9\u51FB\u68CB\u5B50\u5373\u53EF\u88C5\u5907\u6216\u4F7F\u7528\u3002`);
      next.pendingItem = null;
      if (next.pendingAugment) {
        next.phase = "augment";
        break;
      }
      next.phase = "planning";
      if (me.augments.includes("oracle_refresh")) me.freeRerolls = Math.max(me.freeRerolls, 1);
      if (!me.shopLocked) {
        returnShopToPool(next, me);
        me.shop = rollShop(me, next.pool, activeChampions(store2, next), rng);
      }
      break;
    }
    case "EQUIP_ITEM":
      if (next.phase === "planning") equipItem(next, store2, action.itemIndex, action.loc);
      break;
    case "UNEQUIP_ITEM": {
      if (next.phase !== "planning") break;
      const unit = getUnitAt(me, action.loc);
      if (!unit || !unit.items[action.itemIndex]) break;
      const [item] = unit.items.splice(action.itemIndex, 1);
      me.itemInventory.push(item);
      pushLog(next, "\u795E\u5668\u5DF2\u5378\u4E0B\u3002");
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
function createGameReducer(store2) {
  return (state2, action) => reducerWithStore(state2, action, store2);
}

// .verify/engine-test.ts
var dataset = JSON.parse(readFileSync("public/data/roster.json", "utf8"));
var champions = /* @__PURE__ */ new Map();
for (const champion of dataset.characters) champions.set(champion.id, champion);
var store = {
  dataset,
  champions,
  season1: dataset.seasons.season1.map((id) => champions.get(id)).filter((c) => Boolean(c))
};
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
var mode = process.argv[2] === "trial" ? "trial" : "pve";
var state = createInitialState(store, 424242, mode);
var dispatch = createGameReducer(store);
var seenPhases = /* @__PURE__ */ new Set();
var steps = 0;
while (state.phase !== "gameover" && steps++ < 220) {
  seenPhases.add(state.phase);
  const me = state.players[0];
  if (state.phase === "augment" && state.pendingAugment) {
    state = dispatch(state, { type: "CHOOSE_AUGMENT", id: state.pendingAugment.choices[0] });
    continue;
  }
  if (state.phase === "item" && state.pendingItem) {
    state = dispatch(state, { type: "CHOOSE_ITEM", id: state.pendingItem.choices[0] });
    continue;
  }
  if (state.phase === "planning") {
    for (let i = 0; i < me.shop.length; i++) {
      const cid = me.shop[i].championId;
      const champion = cid ? champions.get(cid) : null;
      if (champion && me.gold - (state.round > 2 ? 4 : 0) >= champion.cost) {
        const before = me.gold;
        state = dispatch(state, { type: "BUY_UNIT", slot: i });
        if (state.players[0].gold === before) break;
      }
    }
    const current = state.players[0];
    const benchIndex = current.bench.findIndex(Boolean);
    if (benchIndex >= 0 && boardCount(current) < deployLimit(current)) {
      let empty = null;
      for (let y = 0; y < 4 && !empty; y++) for (let x = 0; x < 8 && !empty; x++) if (!current.board[`${x},${y}`]) empty = { x, y };
      if (empty) state = dispatch(state, { type: "MOVE_UNIT", from: { type: "bench", index: benchIndex }, to: { type: "board", x: empty.x, y: empty.y } });
    }
    if (state.players[0].gold >= 20) state = dispatch(state, { type: "BUY_XP" });
    state = dispatch(state, { type: "START_COMBAT" });
    continue;
  }
  if (state.phase === "combat") {
    assert(state.combat != null, "combat phase missing combat");
    assert(state.combat.result.frames.length > 2, "combat produced too few frames");
    state = dispatch(state, { type: "COMBAT_FINISHED" });
    continue;
  }
  throw new Error(`unexpected phase ${state.phase}`);
}
assert(seenPhases.has("combat"), "never entered combat");
assert(seenPhases.has("augment"), "never saw augment choice");
assert(seenPhases.has("item"), "never saw item choice");
assert(state.round >= 8 || state.phase === "gameover", `match ended implausibly early at round ${state.round}`);
var aliveBots = state.players.filter((p) => !p.isHuman && p.alive).length;
console.log(JSON.stringify({ mode, phase: state.phase, round: state.round, roundType: state.roundType, result: state.gameResult, humanHp: state.players[0].hp, players: state.players.length, aliveBots, phases: [...seenPhases], steps }, null, 2));
