import { readFileSync } from "node:fs";
import type { Champion, CombatResult, RosterDataset } from "../src/types";
import type { DataStore } from "../src/data";
import { augmentTierWeight, chooseBalancedAugments, chooseBalancedItems, hpComebackGoldBonus, itemTierWeight, lossStreakGoldBonus, winStreakGoldBonus } from "../src/game/balance";
import { itemById } from "../src/game/definitions";
import { createGameReducer, createInitialState } from "../src/game/engine";
import { makeUnit } from "../src/game/roster";
import { mulberry32 } from "../src/game/random";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(winStreakGoldBonus(0) === 0 && winStreakGoldBonus(2) === 1 && winStreakGoldBonus(4) === 2 && winStreakGoldBonus(6) === 3, "win streak gold table mismatch");
assert(lossStreakGoldBonus(0) === 0 && lossStreakGoldBonus(2) === 1 && lossStreakGoldBonus(3) === 2 && lossStreakGoldBonus(4) === 3 && lossStreakGoldBonus(5) === 4, "loss streak gold table mismatch");
for (let streak = 2; streak <= 6; streak++) {
  assert(lossStreakGoldBonus(streak) >= winStreakGoldBonus(streak), `loss streak ${streak} should catch up at least as fast as winning`);
}

assert(hpComebackGoldBonus(100, 100) === 0 && hpComebackGoldBonus(80, 100) === 1 && hpComebackGoldBonus(60, 100) === 2, "HP deficit gold bonus table mismatch");
assert(itemTierWeight(3, 0, 4) < itemTierWeight(3, 0, 0), "win streak should reduce T3 item weight");
assert(augmentTierWeight(3, 0, 4) < augmentTierWeight(3, 0, 0), "win streak should reduce T3 augment weight");

function itemStats(lossStreak: number, samples = 400) {
  const tierPicks = { 1: 0, 2: 0, 3: 0 };
  let withAdvanced = 0;
  let withTier3 = 0;
  for (let seed = 1; seed <= samples; seed++) {
    const picks = chooseBalancedItems(mulberry32(seed * 991 + lossStreak * 77), lossStreak);
    assert(picks.length === 3, `expected 3 item choices, got ${picks.length}`);
    assert(new Set(picks.map((item) => item.id)).size === picks.length, "duplicate item choices");
    for (const item of picks) tierPicks[item.tier] += 1;
    if (picks.some((item) => item.tier >= 2)) withAdvanced += 1;
    if (picks.some((item) => item.tier === 3)) withTier3 += 1;
  }
  return {
    tierPicks,
    advancedRate: withAdvanced / samples,
    tier3Rate: withTier3 / samples,
  };
}

const normalItems = itemStats(0);
const twoLossItems = itemStats(2);
const fourLossItems = itemStats(4);
assert(twoLossItems.advancedRate === 1, "2-loss item choices should always include at least one T2+ item");
assert(itemStats(3).advancedRate === 1, "3-loss item choices should always include advanced items");
assert(fourLossItems.tier3Rate === 1, "4-loss item choices should always include at least one T3 item");
assert(fourLossItems.tierPicks[3] > normalItems.tierPicks[3] * 4, "4-loss item choices should be heavily weighted toward T3");
assert(normalItems.tierPicks[1] > normalItems.tierPicks[3], "normal item choices should still favor basic T1 items");

for (let seed = 1; seed <= 160; seed++) {
  const threeLoss = chooseBalancedItems(mulberry32(seed * 733), 3);
  assert(threeLoss.filter((item) => item.tier >= 2).length >= 2, "3-loss item choices should include at least two T2+ options");
  const fourLoss = chooseBalancedItems(mulberry32(seed * 733), 4);
  assert(fourLoss.some((item) => item.tier === 3), "4-loss item choices should include T3");
  assert(fourLoss.filter((item) => item.tier >= 2).length >= 2, "4-loss item choices should include T3 plus another T2+ option");
}

for (let seed = 1; seed <= 120; seed++) {
  const normal = chooseBalancedAugments(mulberry32(seed * 313), 3, [], 0);
  assert(normal.length === 3, "normal round-3 augment choice count mismatch");
  assert(normal.every((augment) => augment.tier === 1), "normal round-3 augments should remain T1");
  const catchup = chooseBalancedAugments(mulberry32(seed * 313), 3, [], 3);
  assert(catchup.some((augment) => augment.tier === 2), "3-loss round-3 augments should guarantee access to T2");
  const lateCatchup = chooseBalancedAugments(mulberry32(seed * 313), 8, [], 3);
  assert(lateCatchup.some((augment) => augment.tier === 3), "3-loss round-8 augments should guarantee access to T3");
}

const dataset = JSON.parse(readFileSync("public/data/roster.json", "utf8")) as RosterDataset;
const champions = new Map<number, Champion>();
for (const champion of dataset.characters) champions.set(champion.id, champion);
const store: DataStore = {
  dataset,
  champions,
  season1: dataset.seasons.season1.map((id) => champions.get(id)).filter((c): c is Champion => Boolean(c)),
};
const dispatch = createGameReducer(store);

function forceCombat(state: ReturnType<typeof createInitialState>, winner: CombatResult["winner"]) {
  const next = structuredClone(state);
  const me = next.players[0];
  if (!Object.keys(me.board).length) me.board["3,2"] = makeUnit(next.activeRoster[0], 1);
  next.phase = "combat";
  next.combat = {
    round: next.round,
    roundType: "pvp",
    opponentId: -1,
    opponentName: "数值测试",
    startedAt: 0,
    result: {
      winner,
      duration: 10,
      survivingPlayer: winner === "player" ? 0.6 : 0,
      survivingEnemy: winner === "enemy" ? 0.6 : 0,
      playerUnitsLeft: winner === "player" ? 1 : 0,
      enemyUnitsLeft: winner === "enemy" ? 1 : 0,
      frames: [],
      events: [],
      unitLabels: {},
      damageDealt: {},
      healingDone: {},
    },
  };
  return next;
}

let state = createInitialState(store, 917263, "pve");
state = forceCombat(state, "enemy");
state = dispatch(state, { type: "COMBAT_FINISHED" });
assert(state.players[0].lossStreak === 1, "first forced loss did not create loss streak 1");
assert(state.phase === "planning", "first loss should not yet grant catch-up artifact");
state = forceCombat(state, "enemy");
state = dispatch(state, { type: "COMBAT_FINISHED" });
assert(state.players[0].lossStreak === 2, "second forced loss did not create loss streak 2");
assert(state.phase === "item" && state.pendingItem, "second consecutive loss should grant catch-up artifact choice");
assert(state.pendingItem!.choices.some((id) => itemById(id).tier >= 2), "catch-up artifact choice should include at least one T2+ item");
assert(state.log.some((line) => line.includes("连败补给")), "catch-up artifact log missing");
assert(state.log.some((line) => line.includes("连败追赶加成")), "catch-up gold log missing");

state = dispatch(state, { type: "CHOOSE_ITEM", id: state.pendingItem!.choices[0] });
assert(state.phase === "planning", "non-augment catch-up artifact should return to planning");
state = forceCombat(state, "enemy");
state = dispatch(state, { type: "COMBAT_FINISHED" });
assert(state.players[0].lossStreak === 3, "third forced loss did not create loss streak 3");
assert(state.phase === "item" && state.pendingItem && state.pendingAugment, "round-3 loss should chain catch-up artifact into augment choice");
const chainedItem = state.pendingItem.choices[0];
state = dispatch(state, { type: "CHOOSE_ITEM", id: chainedItem });
assert(state.phase === "augment" && state.pendingAugment, "artifact choice should chain into augment on round 3");
assert(state.pendingAugment!.choices.length === 3, "round-3 catch-up augment choice count mismatch");

console.log(JSON.stringify({
  gold: {
    win: [0, 1, 2, 3, 4, 5, 6].map(winStreakGoldBonus),
    loss: [0, 1, 2, 3, 4, 5, 6].map(lossStreakGoldBonus),
  },
  items: {
    normalItems,
    twoLossItems,
    fourLossItems,
  },
  forcedLosses: {
    phase: state.phase,
    lossStreak: state.players[0].lossStreak,
    chainedItem,
    augmentChoices: state.pendingAugment?.choices,
    gold: state.players[0].gold,
    hp: state.players[0].hp,
  },
}, null, 2));
