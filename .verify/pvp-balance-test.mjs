// .verify/pvp-balance-test.ts
import { spawn } from "node:child_process";
import WebSocket from "ws";

// src/game/definitions.ts
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
function itemById(id) {
  return ITEMS.find((item) => item.id === id) ?? ITEMS[0];
}
function augmentById(id) {
  return AUGMENTS.find((augment) => augment.id === id) ?? AUGMENTS[0];
}

// .verify/pvp-balance-test.ts
var port = 8892;
var url = `ws://127.0.0.1:${port}`;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function client(name) {
  const ws = new WebSocket(url);
  const c = { ws, name, latest: null, code: null, open: Promise.resolve(), send: () => void 0 };
  ws.on("message", (raw) => {
    const message = JSON.parse(String(raw));
    if (message.type === "state") {
      c.latest = message;
      c.code = message.room.code;
    }
  });
  c.open = new Promise((resolve, reject) => {
    ws.on("open", resolve);
    ws.on("error", reject);
  });
  c.send = (value) => ws.send(JSON.stringify(value));
  return c;
}
async function waitFor(fn, timeout, label) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = fn();
    if (value) return value;
    await sleep(80);
  }
  throw new Error(`timeout ${label}`);
}
function me(c) {
  return c.latest.game.players[0];
}
async function buyAndDeployOne(c) {
  await waitFor(() => c.latest?.game.phase === "planning", 5e3, `${c.name} planning`);
  const slot = me(c).shop.findIndex((entry) => entry.championId);
  assert(slot >= 0, `${c.name} has no buyable shop slot`);
  c.send({ type: "action", action: { type: "BUY_UNIT", slot } });
  await waitFor(() => me(c).bench.some(Boolean), 4e3, `${c.name} buy`);
  c.send({ type: "action", action: { type: "MOVE_UNIT", from: { type: "bench", index: me(c).bench.findIndex(Boolean) }, to: { type: "board", x: 3, y: 2 } } });
  await waitFor(() => Object.keys(me(c).board).length > 0, 4e3, `${c.name} deploy`);
}
async function settleRewards(c) {
  for (let i = 0; i < 2; i++) {
    const game = c.latest.game;
    if (game.phase === "item" && game.pendingItem) {
      c.send({ type: "action", action: { type: "CHOOSE_ITEM", id: game.pendingItem.choices[0] } });
    } else if (game.phase === "augment" && game.pendingAugment) {
      c.send({ type: "action", action: { type: "CHOOSE_AUGMENT", id: game.pendingAugment.choices[0] } });
    }
    await sleep(300);
  }
}
async function waitServerReady(child) {
  await waitFor(() => serverOutput.includes("websocket server listening"), 8e3, "test pvp server boot");
}
var serverOutput = "";
var server = null;
var strong = null;
var weak = null;
try {
  server = spawn(process.execPath, ["--import", "tsx", "server/pvp-server.ts"], {
    env: { ...process.env, PVP_PORT: String(port), PVP_PLANNING_MS: "2400" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  server.stdout?.on("data", (chunk) => {
    serverOutput += String(chunk);
  });
  server.stderr?.on("data", (chunk) => {
    serverOutput += String(chunk);
  });
  await waitServerReady(server);
  strong = client("Strong");
  weak = client("Weak");
  await Promise.all([strong.open, weak.open]);
  strong.send({ type: "create", name: "Strong" });
  await waitFor(() => strong.code, 5e3, "room code");
  weak.send({ type: "join", name: "Weak", code: strong.code });
  await waitFor(() => strong.latest?.room.phase === "planning" && weak.latest?.room.phase === "planning", 5e3, "room join");
  await buyAndDeployOne(strong);
  const rounds = [];
  for (let round = 1; round <= 4; round++) {
    await waitFor(() => strong.latest.room.phase === "combat" && weak.latest.room.phase === "combat", 8e3, `timeout combat ${round}`);
    strong.send({ type: "skip" });
    weak.send({ type: "skip" });
    await waitFor(() => strong.latest.game.phase === "item" && weak.latest.game.phase === "item", 8e3, `item ${round}`);
    const strongMe = me(strong);
    const weakMe = me(weak);
    const snapshot = {
      round,
      winnerStrong: strong.latest.game.combat?.result.winner ?? "resolved",
      strongStreak: strongMe.winStreak,
      weakLossStreak: weakMe.lossStreak,
      weakGold: weakMe.gold,
      strongGold: strongMe.gold,
      weakHp: weakMe.hp,
      strongHp: strongMe.hp,
      weakHasHpBonusLog: weak.latest.game.log.some((line) => line.includes("\u8840\u91CF\u843D\u540E\u8865\u507F")),
      weakItemTiers: weak.latest.game.pendingItem.choices.map((id) => itemById(id).tier),
      strongItemTiers: strong.latest.game.pendingItem.choices.map((id) => itemById(id).tier),
      weakAugmentTiers: weak.latest.game.pendingAugment?.choices.map((id) => augmentById(id).tier) ?? null,
      strongAugmentTiers: strong.latest.game.pendingAugment?.choices.map((id) => augmentById(id).tier) ?? null,
      weakLog: weak.latest.game.log.slice(0, 5)
    };
    rounds.push(snapshot);
    await settleRewards(strong);
    await settleRewards(weak);
    if (round < 4) {
      await waitFor(() => strong.latest.game.phase === "planning" && weak.latest.game.phase === "planning", 6e3, `planning after ${round}`);
    }
  }
  const round2 = rounds.find((entry) => entry.round === 2);
  const round3 = rounds.find((entry) => entry.round === 3);
  assert(round2?.weakLossStreak === 2, `expected weak player loss streak 2, got ${round2?.weakLossStreak}`);
  assert(round2.weakItemTiers.some((tier) => tier >= 2), "round-2 loser artifact choices should include T2+");
  assert(round3?.weakLossStreak === 3, `expected weak player loss streak 3, got ${round3?.weakLossStreak}`);
  assert(round3.weakItemTiers.filter((tier) => tier >= 2).length >= 2, "round-3 loser artifact choices should include at least two T2+ options");
  assert(round3.weakAugmentTiers?.some((tier) => tier === 2), "round-3 loser augment choices should include T2 through catch-up");
  assert(round3.strongAugmentTiers?.every((tier) => tier === 1), "round-3 winner augment choices should remain normal T1");
  const round4 = rounds.find((entry) => entry.round === 4);
  assert(round4?.weakLossStreak === 4, `expected weak player loss streak 4, got ${round4?.weakLossStreak}`);
  assert(round4.weakItemTiers.some((tier) => tier === 3), "round-4 loser artifact choices should include T3");
  assert(round4.weakItemTiers.filter((tier) => tier >= 2).length >= 2, "round-4 loser artifact choices should include T3 plus another T2+ option");
  assert(rounds.some((entry) => entry.weakHasHpBonusLog), "online HP-deficit gold bonus should trigger for the trailing player");
  assert(rounds.every((entry) => entry.weakLossStreak === entry.round), "weak empty board should lose every round");
  console.log(JSON.stringify({ rounds }, null, 2));
} finally {
  strong?.ws.close();
  weak?.ws.close();
  server?.kill();
}
