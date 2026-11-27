import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataStore } from "../data";
import type { GameState, LocationRef } from "../types";
import type { GameAction } from "../game/engine";
import { getUnitAt, sameLocation } from "../game/roster";
import CombatStatsPanel from "./CombatStatsPanel";
import BenchPanel from "./BenchPanel";
import DetailPanel from "./DetailPanel";
import ChampionInfoModal from "./ChampionInfoModal";
import ItemBar from "./ItemBar";
import LogPanel from "./LogPanel";
import PlayerList from "./PlayerList";
import ShopPanel from "./ShopPanel";
import TopBar from "./TopBar";
import TraitPanel from "./TraitPanel";
import { AugmentModal, GameOverModal, ItemModal } from "./Modals";
import { sound } from "../sound";
import { useBoardVoices } from "../hooks/useBoardVoices";
import { useImmersiveDrawers } from "../hooks/useImmersiveDrawers";

const BoardCanvas = lazy(() => import("./BoardCanvas3D"));
import { championsForPoolGroups, POOL_GROUPS, poolGroupName, type PoolGroupId } from "../game/poolGroups";

type RoomPlayer = {
  name: string;
  seat: number;
  hp: number;
  level: number;
  gold: number;
  board: number;
  deployLimit: number;
  ready: boolean;
  connected: boolean;
  phase: string;
} | null;

type OnlinePacket = {
  room: {
    code: string;
    round: number;
    phase: "waiting" | "planning" | "combat" | "gameover";
    you: number;
    players: RoomPlayer[];
    opponentName: string;
    poolGroups?: string[];
    poolSize?: number;
    planningDeadline?: number;
    serverNow?: number;
  };
  game: GameState;
};

interface OnlineScreenProps {
  store: DataStore;
  onExit: () => void;
}

function serverUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.hostname}:8787`;
}

export default function OnlineScreen({ store, onExit }: OnlineScreenProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [packet, setPacket] = useState<OnlinePacket | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState(() => window.localStorage.getItem("valkyrie-pvp-name") ?? "");
  const [code, setCode] = useState("");
  const [selectedPoolGroups, setSelectedPoolGroups] = useState<PoolGroupId[]>(["season1"]);
  const selectedRosterCount = useMemo(() => championsForPoolGroups(store.dataset, selectedPoolGroups).length, [store.dataset, selectedPoolGroups]);

  const connect = useCallback((fn: () => void) => {
    setError("");
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      fn();
      return;
    }
    const ws = new WebSocket(serverUrl());
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      fn();
    };
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data));
        if (message.type === "state") setPacket(message as OnlinePacket);
        if (message.type === "error") setError(message.message ?? "联机错误");
      } catch {
        // Ignore malformed packets.
      }
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setError("无法连接 PVP 服务器。请确认 npm run dev 已启动联机服务。");
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(message));
  }, []);

  const create = () => {
    window.localStorage.setItem("valkyrie-pvp-name", name);
    sound.click();
    connect(() => send({ type: "create", name, poolGroups: selectedPoolGroups }));
  };
  const join = () => {
    window.localStorage.setItem("valkyrie-pvp-name", name);
    sound.click();
    connect(() => send({ type: "join", name, code }));
  };

  if (!packet) {
    return (
      <div className="online-screen">
        <div className="online-card">
          <span className="lobby-kicker">LAN MULTIPLAYER</span>
          <h1>真人对决</h1>
          <p>通过局域网 WebSocket 服务器创建或加入双人房间。双方各自经营商店、升星、装备与符文；同时准备后进入真实玩家棋盘对战。</p>
          <label>你的昵称<input value={name} maxLength={18} onChange={(e) => setName(e.target.value)} /></label>
          <div className="pool-picker">
            <div className="pool-picker-title">
              <strong>角色池分类</strong>
              <span>{selectedRosterCount} 名角色进入商店</span>
            </div>
            {(["preset", "original", "collab"] as const).map((kind) => (
              <div className="pool-picker-row" key={kind}>
                {POOL_GROUPS.filter((group) => group.kind === kind).map((group) => {
                  const active = selectedPoolGroups.includes(group.id);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`pool-chip ${active ? "active" : ""}`}
                      onClick={() => {
                        sound.click();
                        setSelectedPoolGroups((current) => {
                          const next = active ? current.filter((id) => id !== group.id) : [...current, group.id];
                          return next.length ? next : ["season1"];
                        });
                      }}
                    >
                      {group.name}
                    </button>
                  );
                })}
              </div>
            ))}
            <small>分类规则来自原版图鉴的作品/系列：同一动漫联动为一类，原作角色按本家经典、异端者、反叛者、观测者等称号系列分类。多个分类取并集；池内仍保留完整的属性、种族和职业多样性。人数太少会难以升星，建议 80 名以上。</small>
          </div>
          <div className="online-actions">
            <button className="primary-button" onClick={create}>创建房间</button>
            <div className="join-row">
              <input value={code} maxLength={5} placeholder="房间码" onChange={(e) => setCode(e.target.value.toUpperCase())} />
              <button className="ghost-button" disabled={code.trim().length < 4} onClick={join}>加入房间</button>
            </div>
          </div>
          {error && <div className="online-error">{error}</div>}
          <div className="online-hint">服务器状态：{connected ? "已连接" : "未连接"} · 局域网设备请使用主机局域网 IP 访问本页面</div>
          <button className="ghost-button compact" onClick={onExit}>返回大厅</button>
        </div>
      </div>
    );
  }

  if (packet.room.phase === "waiting") {
    return (
      <div className="online-screen">
        <div className="online-card waiting">
          <span className="lobby-kicker">ROOM READY</span>
          <h1>等待对手加入</h1>
          <div className="room-code">{packet.room.code}</div>
          <p>把房间码告诉同一局域网内的玩家。对方进入“真人对决”并输入房间码即可加入。</p>
          <div className="room-pool-summary">角色池：{packet.room.poolSize ?? "—"} 名 · {(packet.room.poolGroups ?? []).map((id) => poolGroupName(id as PoolGroupId)).join(" / ") || "第一赛季"}</div>
          <div className="online-hint">当前连接：{connected ? "正常" : "断开"}</div>
          <button className="ghost-button compact" onClick={onExit}>离开房间</button>
        </div>
      </div>
    );
  }

  return <OnlineGame store={store} packet={packet} send={send} onExit={onExit} />;
}

function OnlineGame({ store, packet, send, onExit }: { store: DataStore; packet: OnlinePacket; send: (message: unknown) => void; onExit: () => void }) {
  const state = packet.game;
  const [selectedLoc, setSelectedLoc] = useState<LocationRef | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [inspectedChampionId, setInspectedChampionId] = useState<number | null>(null);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [popupChampionId, setPopupChampionId] = useState<number | null>(null);
  const player = state.players[0];
  const { drawers, toggleDrawer } = useImmersiveDrawers(state.phase, state.round);
  useBoardVoices(player.board);
  const opponentPlayer = useMemo(() => {
    const summary = packet.room.players.find((p) => p && p.seat !== packet.room.you);
    if (!summary) return null;
    return {
      ...structuredClone(player),
      id: 1,
      name: summary.name,
      isHuman: false,
      hp: summary.hp,
      level: summary.level,
      gold: summary.gold,
      board: {},
      bench: Array(9).fill(null),
    } as typeof player;
  }, [packet, player]);
  const players = opponentPlayer ? [player, opponentPlayer] : [player];

  const dispatch = useCallback((action: GameAction) => {
    if (action.type === "START_COMBAT") {
      sound.click();
      send({ type: "ready" });
      return;
    }
    if (action.type === "COMBAT_FINISHED") {
      send({ type: "skip" });
      return;
    }
    if (action.type === "NEW_GAME") return;
    send({ type: "action", action });
  }, [send]);

  const inspectChampion = useCallback((championId: number, popup = false) => {
    setInspectedChampionId(championId);
    setInspectedItemId(null);
    if (popup) setPopupChampionId(championId);
  }, []);
  const inspectItem = useCallback((itemId: string) => {
    setInspectedItemId(itemId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedLoc(null);
    setSelectedItemIndex(null);
  }, []);

  const handleLocationClick = useCallback((loc: LocationRef | null) => {
    if (state.phase !== "planning") return;
    if (!loc) {
      setSelectedLoc(null);
      return;
    }
    if (selectedItemIndex != null) {
      if (getUnitAt(player, loc)) {
        dispatch({ type: "EQUIP_ITEM", itemIndex: selectedItemIndex, loc });
        setSelectedItemIndex(null);
      }
      return;
    }
    const unit = getUnitAt(player, loc);
    if (selectedLoc) {
      if (sameLocation(selectedLoc, loc)) setSelectedLoc(null);
      else {
        dispatch({ type: "MOVE_UNIT", from: selectedLoc, to: loc });
        setSelectedLoc(null);
      }
      if (unit) setInspectedChampionId(unit.championId);
      return;
    }
    if (unit) {
      setSelectedLoc(loc);
      setInspectedChampionId(unit.championId);
    }
  }, [player, selectedItemIndex, selectedLoc, state.phase, dispatch]);

  const combatClockRef = useRef("");
  useEffect(() => {
    if (state.phase === "combat" && state.combat) {
      const key = `${state.round}:${state.combat.opponentName}:${state.combat.startedAt}`;
      if (combatClockRef.current !== key) {
        combatClockRef.current = key;
        sound.battleStart();
        sound.bgm("bgm_battle_pvp");
      }
    } else {
      combatClockRef.current = "";
      if (state.phase !== "gameover") sound.bgm("bgm_map");
    }
  }, [state.phase, state.round, state.combat]);

  useEffect(() => {
    (window as unknown as { __VALKYRIE_STATE__?: GameState }).__VALKYRIE_STATE__ = state;
  }, [state]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const target = window as unknown as { __VALKYRIE_PVP_SEND__?: (message: unknown) => void };
    target.__VALKYRIE_PVP_SEND__ = send;
    return () => {
      if (target.__VALKYRIE_PVP_SEND__ === send) delete target.__VALKYRIE_PVP_SEND__;
    };
  }, [send]);

  const lastLogRef = useRef<string>("");
  useEffect(() => {
    const latest = state.log[0] ?? "";
    if (!latest || latest === lastLogRef.current) return;
    lastLogRef.current = latest;
    if (latest.includes("合成完成")) sound.combine();
    else if (latest.includes("购入")) sound.buy();
    else if (latest.includes("获得神器")) sound.item();
    else if (latest.includes("获得强化符文")) sound.reward();
  }, [state.log]);

  const opponentSummary = packet.room.players.find((p) => p && p.seat !== packet.room.you);
  const meSummary = packet.room.players.find((p) => p && p.seat === packet.room.you);
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (packet.room.phase !== "planning") return;
    const timer = window.setInterval(() => setClockTick((v) => v + 1), 500);
    return () => window.clearInterval(timer);
  }, [packet.room.phase]);
  const serverOffset = (packet.room.serverNow ?? Date.now()) - Date.now();
  const planningSeconds = packet.room.planningDeadline ? Math.max(0, Math.ceil((packet.room.planningDeadline - Date.now() - serverOffset) / 1000)) : null;
  void clockTick;
  const toggleSidePanel = (event: React.MouseEvent<HTMLElement>) => {
    const title = (event.target as HTMLElement).closest(".panel-title-row");
    title?.parentElement?.classList.toggle("collapsed");
  };

  return (
    <div className={`app-shell online-game-shell immersive-app phase-${state.phase}`}>
      <div className={`battle-shell phase-${state.phase} ${drawers.top ? "top-open" : ""} ${drawers.bottom ? "bottom-open" : ""} ${drawers.left ? "left-open" : ""} ${drawers.right ? "right-open" : ""}`}>
        <Suspense fallback={<div className="board-canvas-wrap board-loading"><span>正在加载 3D 战场…</span></div>}>
          <BoardCanvas store={store} state={state} selected={selectedLoc} onLocationClick={handleLocationClick} onCombatEnd={() => dispatch({ type: "COMBAT_FINISHED" })} onInspect={inspectChampion} />
        </Suspense>

        <button type="button" className={`drawer-tab drawer-tab-top ${drawers.top ? "open" : ""}`} onClick={() => toggleDrawer("top")}>{planningSeconds != null ? `资源 ${planningSeconds}s` : "资源"}</button>
        <button type="button" className={`drawer-tab drawer-tab-left ${drawers.left ? "open" : ""}`} onClick={() => toggleDrawer("left")}>阵容</button>
        <button type="button" className={`drawer-tab drawer-tab-right ${drawers.right ? "open" : ""}`} onClick={() => toggleDrawer("right")}>详情</button>
        <button type="button" className={`drawer-tab drawer-tab-bottom ${drawers.bottom ? "open" : ""}`} onClick={() => toggleDrawer("bottom")}>商店</button>

        <div className={`top-drawer ${drawers.top ? "open" : ""}`}>
          <div className="online-status-strip">
            <span>房间 <strong>{packet.room.code}</strong></span>
            <span>对手 <strong>{packet.room.opponentName}</strong></span>
            <span>你 {meSummary?.ready ? "已准备" : "未准备"} · 对手 {opponentSummary?.ready ? "已准备" : "未准备"}</span>
            {packet.room.phase === "planning" && planningSeconds != null && <span className="planning-countdown">准备倒计时 {planningSeconds}s</span>}
          </div>
          <TopBar state={state} dispatch={dispatch} onExit={onExit} />
        </div>

        <aside className={`left-sidebar drawer-panel left-drawer ${drawers.left ? "open" : ""}`}>
          <PlayerList players={players} currentOpponentId={state.combat?.opponentId} />
          <TraitPanel store={store} player={player} />
        </aside>

        <aside className={`right-sidebar drawer-panel right-drawer ${drawers.right ? "open" : ""}`} onClick={toggleSidePanel}>
          <DetailPanel store={store} player={player} selected={selectedLoc} inspectedChampionId={inspectedChampionId} inspectedItemId={inspectedItemId} dispatch={dispatch} clearSelection={clearSelection} />
          <LogPanel log={state.log} />
        </aside>

        <div className={`bottom-drawer ${drawers.bottom ? "open" : ""}`}>
          <div className="bottom-row">
            <div className="bench-column">
              <BenchPanel store={store} player={player} selected={selectedLoc} onLocationClick={handleLocationClick} onInspect={inspectChampion} />
              <ItemBar player={player} selectedItemIndex={selectedItemIndex} onSelectItem={setSelectedItemIndex} onInspectItem={inspectItem} />
            </div>
            <ShopPanel store={store} player={player} pool={state.pool} phase={state.phase} dispatch={dispatch} onInspect={inspectChampion} />
          </div>
        </div>

        {state.phase === "combat" && state.combat && (
          <div className="combat-stats-float" onClick={toggleSidePanel}>
            <CombatStatsPanel store={store} combat={state.combat} speed={state.combatSpeed} />
          </div>
        )}
      </div>

      {state.phase === "augment" && state.pendingAugment && <AugmentModal choices={state.pendingAugment.choices} dispatch={dispatch} />}
      {state.phase === "item" && state.pendingItem && <ItemModal choices={state.pendingItem.choices} dispatch={dispatch} />}
      {state.phase === "gameover" && <GameOverModal state={state} dispatch={dispatch} />}
      <ChampionInfoModal store={store} player={player} championId={popupChampionId} dispatch={dispatch} onClose={() => setPopupChampionId(null)} />
    </div>
  );
}
