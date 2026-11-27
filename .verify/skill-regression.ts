import { readFileSync } from "node:fs";
import type { Champion, RosterDataset } from "../src/types";
import { simulateCombat, type CombatEntry, type CombatTeamInput } from "../src/game/combat";
import { makeUnit } from "../src/game/roster";

const dataset = JSON.parse(readFileSync("public/data/roster.json", "utf8")) as RosterDataset;
const champions = new Map<number, Champion>();
for (const champion of dataset.characters) champions.set(champion.id, champion);
function entry(id: number, x: number, y: number, star = 1): CombatEntry {
  const champion = champions.get(id);
  if (!champion) throw new Error(`missing champion ${id}`);
  return { unit: makeUnit(id, star), champion, x, y };
}
function input(entries: CombatEntry[], powerBonus = 1): CombatTeamInput {
  return { entries, traits: { races: {}, roles: {}, elements: {} }, augments: [], powerBonus };
}
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

// Sculd's original skill text explicitly says: attack all enemies and restore all allies.
const sculdTeam = input([entry(101001, 3, 7), entry(101002, 4, 5)]);
const enemyTeam = input([entry(106015, 3, 1), entry(101004, 4, 1)], 0.82);
let result = simulateCombat(sculdTeam, enemyTeam, 9917);
let chosenSeed = 9917;
for (let seed = 1000; seed < 1160; seed++) {
  const candidate = simulateCombat(sculdTeam, enemyTeam, seed);
  if (candidate.events.some((e) => e.type === "heal" && e.source === 1 && e.target === 2)) {
    result = candidate;
    chosenSeed = seed;
    break;
  }
}
const sculdId = 1;
const sculdHeals = result.events.filter((e) => e.type === "heal" && e.source === sculdId);
const healedIds = new Set(sculdHeals.map((e) => e.target));
const skillCast = result.events.find((e) => e.type === "skill" && e.source === sculdId);
const sculdSkillTargets = new Set(result.events.filter((e) => e.type === "damage" && e.source === sculdId && e.target != null && skillCast && Math.abs(e.t - skillCast.t) < 0.001).map((e) => e.target));
assert(sculdHeals.some((e) => (e.amount ?? 0) > 80), `expected Sculd percent heal to be meaningful, got ${JSON.stringify(sculdHeals)}`);
assert(healedIds.has(1) && healedIds.has(2), `expected both player units to receive heal events, got ${[...healedIds].join(",")}`);
assert(Boolean(skillCast), "expected Sculd to cast her skill");
assert(sculdSkillTargets.size >= 2, `expected Sculd skill to hit all/multiple enemies, got ${sculdSkillTargets.size}`);

// A unit with no revive item must die when reduced below zero; combat cannot leave an immortal zero-HP unit.
const victim = input([entry(101001, 3, 6)]);
const executioner = input([entry(106015, 3, 1, 3), entry(101002, 4, 1, 3)], 5);
const lethal = simulateCombat(victim, executioner, 771);
const victimDeath = lethal.events.find((e) => e.type === "death" && e.target === 1);
assert(Boolean(victimDeath), `expected victim death event; winner=${lethal.winner}`);
assert(lethal.playerUnitsLeft === 0 && lethal.winner === "enemy", `expected enemy win after victim death, got winner=${lethal.winner} left=${lethal.playerUnitsLeft}`);

console.log(JSON.stringify({
  chosenSeed,
  sculdHeals: sculdHeals.map((e) => ({ t: e.t, target: e.target, amount: e.amount })),
  sculdSkillTargets: sculdSkillTargets.size,
  lethalWinner: lethal.winner,
  victimDeathT: victimDeath?.t,
  playerUnitsLeft: lethal.playerUnitsLeft,
}, null, 2));
