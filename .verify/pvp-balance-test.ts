import { spawn, type ChildProcess } from "node:child_process";
import WebSocket from "ws";
import { itemById, augmentById } from "../src/game/definitions";

const port = 8892;
const url = `ws://127.0.0.1:${port}`;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Client = {
  ws: WebSocket;
  name: string;
  latest: any;
  code: string | null;
  open: Promise<void>;
  send: (value: unknown) => void;
};

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function client(name: string): Client {
  const ws = new WebSocket(url);
  const c: Client = { ws, name, latest: null, code: null, open: Promise.resolve(), send: () => undefined };
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

async function waitFor<T>(fn: () => T | false | null | undefined, timeout: number, label: string): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = fn();
    if (value) return value;
    await sleep(80);
  }
  throw new Error(`timeout ${label}`);
}

function me(c: Client) {
  return c.latest.game.players[0];
}

async function buyAndDeployOne(c: Client): Promise<void> {
  await waitFor(() => c.latest?.game.phase === "planning", 5000, `${c.name} planning`);
  const slot = me(c).shop.findIndex((entry: any) => entry.championId);
  assert(slot >= 0, `${c.name} has no buyable shop slot`);
  c.send({ type: "action", action: { type: "BUY_UNIT", slot } });
  await waitFor(() => me(c).bench.some(Boolean), 4000, `${c.name} buy`);
  c.send({ type: "action", action: { type: "MOVE_UNIT", from: { type: "bench", index: me(c).bench.findIndex(Boolean) }, to: { type: "board", x: 3, y: 2 } } });
  await waitFor(() => Object.keys(me(c).board).length > 0, 4000, `${c.name} deploy`);
}

async function settleRewards(c: Client): Promise<void> {
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

async function waitServerReady(child: ChildProcess): Promise<void> {
  await waitFor(() => serverOutput.includes("websocket server listening"), 8000, "test pvp server boot");
}

let serverOutput = "";
let server: ChildProcess | null = null;
let strong: Client | null = null;
let weak: Client | null = null;

try {
  server = spawn(process.execPath, ["--import", "tsx", "server/pvp-server.ts"], {
    env: { ...process.env, PVP_PORT: String(port), PVP_PLANNING_MS: "2400" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => { serverOutput += String(chunk); });
  server.stderr?.on("data", (chunk) => { serverOutput += String(chunk); });
  await waitServerReady(server);

  strong = client("Strong");
  weak = client("Weak");
  await Promise.all([strong.open, weak.open]);
  strong.send({ type: "create", name: "Strong" });
  await waitFor(() => strong!.code, 5000, "room code");
  weak.send({ type: "join", name: "Weak", code: strong.code });
  await waitFor(() => strong!.latest?.room.phase === "planning" && weak!.latest?.room.phase === "planning", 5000, "room join");
  await buyAndDeployOne(strong);

  const rounds: any[] = [];
  for (let round = 1; round <= 4; round++) {
    await waitFor(() => strong!.latest.room.phase === "combat" && weak!.latest.room.phase === "combat", 8000, `timeout combat ${round}`);
    strong.send({ type: "skip" });
    weak.send({ type: "skip" });
    await waitFor(() => strong!.latest.game.phase === "item" && weak!.latest.game.phase === "item", 8000, `item ${round}`);
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
      weakHasHpBonusLog: weak.latest.game.log.some((line: string) => line.includes("血量落后补偿")),
      weakItemTiers: weak.latest.game.pendingItem.choices.map((id: string) => itemById(id).tier),
      strongItemTiers: strong.latest.game.pendingItem.choices.map((id: string) => itemById(id).tier),
      weakAugmentTiers: weak.latest.game.pendingAugment?.choices.map((id: string) => augmentById(id).tier) ?? null,
      strongAugmentTiers: strong.latest.game.pendingAugment?.choices.map((id: string) => augmentById(id).tier) ?? null,
      weakLog: weak.latest.game.log.slice(0, 5),
    };
    rounds.push(snapshot);
    await settleRewards(strong);
    await settleRewards(weak);
    if (round < 4) {
      await waitFor(() => strong!.latest.game.phase === "planning" && weak!.latest.game.phase === "planning", 6000, `planning after ${round}`);
    }
  }

  const round2 = rounds.find((entry) => entry.round === 2);
  const round3 = rounds.find((entry) => entry.round === 3);
  assert(round2?.weakLossStreak === 2, `expected weak player loss streak 2, got ${round2?.weakLossStreak}`);
  assert(round2.weakItemTiers.some((tier: number) => tier >= 2), "round-2 loser artifact choices should include T2+");
  assert(round3?.weakLossStreak === 3, `expected weak player loss streak 3, got ${round3?.weakLossStreak}`);
  assert(round3.weakItemTiers.filter((tier: number) => tier >= 2).length >= 2, "round-3 loser artifact choices should include at least two T2+ options");
  assert(round3.weakAugmentTiers?.some((tier: number) => tier === 2), "round-3 loser augment choices should include T2 through catch-up");
  assert(round3.strongAugmentTiers?.every((tier: number) => tier === 1), "round-3 winner augment choices should remain normal T1");
  const round4 = rounds.find((entry) => entry.round === 4);
  assert(round4?.weakLossStreak === 4, `expected weak player loss streak 4, got ${round4?.weakLossStreak}`);
  assert(round4.weakItemTiers.some((tier: number) => tier === 3), "round-4 loser artifact choices should include T3");
  assert(round4.weakItemTiers.filter((tier: number) => tier >= 2).length >= 2, "round-4 loser artifact choices should include T3 plus another T2+ option");
  assert(rounds.some((entry) => entry.weakHasHpBonusLog), "online HP-deficit gold bonus should trigger for the trailing player");
  assert(rounds.every((entry) => entry.weakLossStreak === entry.round), "weak empty board should lose every round");
  console.log(JSON.stringify({ rounds }, null, 2));
} finally {
  strong?.ws.close();
  weak?.ws.close();
  server?.kill();
}
