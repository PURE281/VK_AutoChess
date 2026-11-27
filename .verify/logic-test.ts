import { addUnitToBench, allUnitRefs, createEmptyPlayer, makeUnit, resetUid, setUnitAt, tryCombine } from "../src/game/roster";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

resetUid(123);
const player = createEmptyPlayer(0, "test", true);
for (let i = 0; i < 3; i++) {
  const result = addUnitToBench(player, makeUnit(101001));
  assert(result.ok, `normal add ${i} failed`);
}
let copies = allUnitRefs(player).filter(({ unit }) => unit.championId === 101001);
assert(copies.length === 1, `expected one unit after combine, got ${copies.length}`);
assert(copies[0].unit.star === 2, `expected star 2, got ${copies[0].unit.star}`);

const full = createEmptyPlayer(0, "full", true);
// Two target copies plus seven fillers exactly fill the nine bench slots.
setUnitAt(full, { type: "bench", index: 0 }, makeUnit(202001));
setUnitAt(full, { type: "bench", index: 1 }, makeUnit(202001));
for (let i = 2; i < 9; i++) setUnitAt(full, { type: "bench", index: i }, makeUnit(300000 + i));
const result = addUnitToBench(full, makeUnit(202001));
assert(result.ok, "full-bench combining purchase should be accepted");
copies = allUnitRefs(full).filter(({ unit }) => unit.championId === 202001);
assert(copies.length === 1 && copies[0].unit.star === 2, `expected full-bench star2 combine, got ${JSON.stringify(copies)}`);
assert(allUnitRefs(full).length === 8, `expected 8 total units after 3-to-1 combine on full bench, got ${allUnitRefs(full).length}`);

const chain = createEmptyPlayer(0, "chain", true);
for (let i = 0; i < 9; i++) addUnitToBench(chain, makeUnit(303001));
copies = allUnitRefs(chain).filter(({ unit }) => unit.championId === 303001);
assert(copies.length === 1 && copies[0].unit.star === 3, `expected chained star3, got ${JSON.stringify(copies)}`);
console.log("logic tests passed");
