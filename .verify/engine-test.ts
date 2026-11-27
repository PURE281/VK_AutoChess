import { readFileSync } from "node:fs";
import type { RosterDataset, Champion } from "../src/types";
import type { DataStore } from "../src/data";
import { createGameReducer, createInitialState } from "../src/game/engine";
import { boardCount, deployLimit } from "../src/game/roster";

const dataset = JSON.parse(readFileSync("public/data/roster.json", "utf8")) as RosterDataset;
const champions = new Map<number, Champion>();
for (const champion of dataset.characters) champions.set(champion.id, champion);
const store: DataStore = {
  dataset,
  champions,
  season1: dataset.seasons.season1.map((id) => champions.get(id)).filter((c): c is Champion => Boolean(c)),
};
function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}
const mode = process.argv[2] === "trial" ? "trial" as const : "pve" as const;
let state = createInitialState(store, 424242, mode);
const dispatch = createGameReducer(store);
const seenPhases = new Set<string>();
let steps = 0;
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
    // Buy anything affordable while keeping a small reserve after the opening.
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
      let empty: { x: number; y: number } | null = null;
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
const aliveBots = state.players.filter((p) => !p.isHuman && p.alive).length;
console.log(JSON.stringify({ mode, phase: state.phase, round: state.round, roundType: state.roundType, result: state.gameResult, humanHp: state.players[0].hp, players: state.players.length, aliveBots, phases: [...seenPhases], steps }, null, 2));
