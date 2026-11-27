import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DataStore } from "./data";
import { loadGameData } from "./data";
import type { LoadProgress } from "./data";
import { formatBytes } from "./hooks/useModelLoadProgress";
import type { GameMode, GameState, LocationRef } from "./types";
import { createGameReducer, createInitialState } from "./game/engine";
import { getUnitAt, sameLocation } from "./game/roster";
import CombatStatsPanel from "./components/CombatStatsPanel";
import BenchPanel from "./components/BenchPanel";
import DetailPanel from "./components/DetailPanel";
import ChampionInfoModal from "./components/ChampionInfoModal";
import ItemBar from "./components/ItemBar";
import LogPanel from "./components/LogPanel";
import PlayerList from "./components/PlayerList";
import ShopPanel from "./components/ShopPanel";
import TopBar from "./components/TopBar";
import TraitPanel from "./components/TraitPanel";
import { AugmentModal, GameOverModal, ItemModal } from "./components/Modals";
import { sound } from "./sound";
import Lobby from "./components/Lobby";
import Codex from "./components/Codex";
import OnlineScreen from "./components/OnlineScreen";
import FanNotice from "./components/FanNotice";
import { useBoardVoices } from "./hooks/useBoardVoices";
import { useImmersiveDrawers } from "./hooks/useImmersiveDrawers";

const BoardCanvas = lazy(() => import("./components/BoardCanvas3D"));

function LoadingScreen({ error, progress }: { error?: string; progress: LoadProgress | null }) {
  const startedAtRef = useRef(Date.now());
  const percent = progress?.done ? 100 : progress && progress.total > 0 ? Math.min(99, (progress.loaded / progress.total) * 100) : 0;
  const elapsed = Math.max(0.4, (Date.now() - startedAtRef.current) / 1000);
  const speed = progress ? progress.loaded / elapsed : 0;
  const remaining = progress && progress.total > progress.loaded && speed > 0 ? (progress.total - progress.loaded) / speed : null;
  const etaText = remaining != null && Number.isFinite(remaining)
    ? remaining >= 1 ? `预计还需约 ${Math.ceil(remaining)} 秒` : "即将完成…"
    : progress?.done ? "正在唤醒英灵…" : "正在测算剩余时间…";
  return (
    <div className="loading-screen">
      <div className="loading-rune">ᛟ</div>
      <h1>女武神棋境</h1>
      {error ? (
        <>
          <p className="load-error">{error}</p>
          <button onClick={() => window.location.reload()}>重新加载</button>
        </>
      ) : (
        <>
          <p>正在唤醒 92 位英灵与世界树棋局……</p>
          <div className="loading-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
            <div className="loading-progress-track">
              <i style={{ width: `${Math.max(4, percent)}%` }} />
            </div>
            <div className="loading-progress-meta">
              <span>{progress ? `${formatBytes(progress.loaded)}${progress.total > 0 ? ` / ${formatBytes(progress.total)}` : ""}` : "连接服务器…"}</span>
              <span>{progress?.total ? `${Math.round(percent)}%` : ""}</span>
            </div>
            <div className="loading-progress-eta">{etaText}</div>
          </div>
        </>
      )}
    </div>
  );
}

function GameApp({ store, mode, onExit }: { store: DataStore; mode: GameMode; onExit: () => void }) {
  const reducer = useMemo(() => createGameReducer(store), [store]);
  const initialRef = useRef<GameState | null>(null);
  if (!initialRef.current) initialRef.current = createInitialState(store, Date.now() % 1000000000, mode);
  const [state, dispatch] = useReducer(reducer, initialRef.current);
  const [selectedLoc, setSelectedLoc] = useState<LocationRef | null>(null);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [inspectedChampionId, setInspectedChampionId] = useState<number | null>(null);
  const [inspectedItemId, setInspectedItemId] = useState<string | null>(null);
  const [popupChampionId, setPopupChampionId] = useState<number | null>(null);
  const player = state.players[0];
  const { drawers, toggleDrawer } = useImmersiveDrawers(state.phase, state.round);
  useBoardVoices(player.board);
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

  const handleCombatEnd = useCallback(() => {
    dispatch({ type: "COMBAT_FINISHED" });
    clearSelection();
  }, [clearSelection]);

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
      } else {
        dispatch({ type: "ADD_LOG", message: "神器需要装备在棋子身上。" });
      }
      return;
    }
    const unit = getUnitAt(player, loc);
    if (selectedLoc) {
      if (sameLocation(selectedLoc, loc)) {
        setSelectedLoc(null);
      } else {
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
  }, [player, selectedItemIndex, selectedLoc, state.phase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape") {
        clearSelection();
        return;
      }
      if (state.phase !== "planning") return;
      if (event.key === " " ) {
        event.preventDefault();
        dispatch({ type: "START_COMBAT" });
      } else if (event.key.toLowerCase() === "r") {
        dispatch({ type: "REROLL" });
      } else if (event.key.toLowerCase() === "f") {
        dispatch({ type: "BUY_XP" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearSelection, state.phase]);

  useEffect(() => {
    if (state.phase !== "planning") clearSelection();
  }, [state.phase, clearSelection]);

  const lastLogRef = useRef<string>("");
  useEffect(() => {
    const latest = state.log[0] ?? "";
    if (!latest || latest === lastLogRef.current) return;
    lastLogRef.current = latest;
    if (latest.includes("合成完成")) sound.combine();
    else if (latest.includes("购入")) sound.buy();
    else if (latest.includes("获得神器")) sound.item();
    else if (latest.includes("获得强化符文")) sound.reward();
    else if (latest.includes("等级提升")) sound.levelup();
    else if (latest.includes("金币不足") || latest.includes("无法")) sound.error();
  }, [state.log]);

  useEffect(() => {
    (window as unknown as { __VALKYRIE_STATE__?: GameState }).__VALKYRIE_STATE__ = state;
  }, [state]);

  useEffect(() => {
    if (state.phase === "combat") {
      sound.battleStart();
      sound.bgm(state.roundType === "pvp" ? "bgm_battle_pvp" : "bgm_battle");
    } else if (state.phase !== "gameover") {
      sound.bgm("bgm_map");
    }
  }, [state.phase, state.roundType, state.round]);

  const toggleSidePanel = (event: React.MouseEvent<HTMLElement>) => {
    const title = (event.target as HTMLElement).closest(".panel-title-row");
    title?.parentElement?.classList.toggle("collapsed");
  };

  return (
    <div className={`app-shell immersive-app phase-${state.phase}`}>
      <div className={`battle-shell phase-${state.phase} ${drawers.top ? "top-open" : ""} ${drawers.bottom ? "bottom-open" : ""} ${drawers.left ? "left-open" : ""} ${drawers.right ? "right-open" : ""}`}>
        <Suspense fallback={<div className="board-canvas-wrap board-loading"><span>正在加载 3D 战场…</span></div>}>
          <BoardCanvas
            store={store}
            state={state}
            selected={selectedLoc}
            onLocationClick={handleLocationClick}
            onCombatEnd={handleCombatEnd}
            onInspect={inspectChampion}
          />
        </Suspense>

        <button type="button" className={`drawer-tab drawer-tab-top ${drawers.top ? "open" : ""}`} onClick={() => toggleDrawer("top")}>资源</button>
        <button type="button" className={`drawer-tab drawer-tab-left ${drawers.left ? "open" : ""}`} onClick={() => toggleDrawer("left")}>阵容</button>
        <button type="button" className={`drawer-tab drawer-tab-right ${drawers.right ? "open" : ""}`} onClick={() => toggleDrawer("right")}>详情</button>
        <button type="button" className={`drawer-tab drawer-tab-bottom ${drawers.bottom ? "open" : ""}`} onClick={() => toggleDrawer("bottom")}>商店</button>

        <div className={`top-drawer ${drawers.top ? "open" : ""}`}>
          <TopBar state={state} dispatch={dispatch} onExit={onExit} />
        </div>

        <aside className={`left-sidebar drawer-panel left-drawer ${drawers.left ? "open" : ""}`}>
          <PlayerList players={state.players} currentOpponentId={state.combat?.opponentId} />
          <TraitPanel store={store} player={player} />
        </aside>

        <aside className={`right-sidebar drawer-panel right-drawer ${drawers.right ? "open" : ""}`} onClick={toggleSidePanel}>
          <DetailPanel
            store={store}
            player={player}
            selected={selectedLoc}
            inspectedChampionId={inspectedChampionId}
            inspectedItemId={inspectedItemId}
            dispatch={dispatch}
            clearSelection={clearSelection}
          />
          <LogPanel log={state.log} />
        </aside>

        <div className={`bottom-drawer ${drawers.bottom ? "open" : ""}`}>
          <div className="bottom-row">
            <div className="bench-column">
              <BenchPanel
                store={store}
                player={player}
                selected={selectedLoc}
                onLocationClick={handleLocationClick}
                onInspect={inspectChampion}
              />
              <ItemBar player={player} selectedItemIndex={selectedItemIndex} onSelectItem={setSelectedItemIndex} onInspectItem={inspectItem} />
            </div>
            <ShopPanel
              store={store}
              player={player}
              pool={state.pool}
              phase={state.phase}
              dispatch={dispatch}
              onInspect={inspectChampion}
            />
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

const FAN_NOTICE_KEY = "vc_fan_notice_agreed";

export default function App() {
  const [store, setStore] = useState<DataStore | null>(null);
  const [error, setError] = useState<string>("");
  const [loadProgress, setLoadProgress] = useState<LoadProgress | null>(null);
  const [screen, setScreen] = useState<"lobby" | "codex" | "game" | "online">("lobby");
  const [mode, setMode] = useState<GameMode>("pvp");
  const [runId, setRunId] = useState(0);
  const [noticeAgreed, setNoticeAgreed] = useState(() => {
    try { return localStorage.getItem(FAN_NOTICE_KEY) === "1"; } catch { return false; }
  });
  useEffect(() => {
    let alive = true;
    loadGameData((progress) => {
      if (alive) setLoadProgress({ ...progress });
    })
      .then((data) => {
        if (alive) setStore(data);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);
  const goLobby = () => {
    sound.bgm("bgm_home");
    setScreen("lobby");
  };
  let content: ReactNode;
  if (!store) {
    content = <LoadingScreen error={error} progress={loadProgress} />;
  } else if (screen === "lobby") {
    content = (
      <Lobby
        store={store}
        onCodex={() => setScreen("codex")}
        onOnline={() => setScreen("online")}
        onStart={(nextMode) => {
          setMode(nextMode);
          setRunId((value) => value + 1);
          setScreen("game");
        }}
      />
    );
  } else if (screen === "codex") {
    content = <Codex store={store} onBack={goLobby} />;
  } else if (screen === "online") {
    content = <OnlineScreen store={store} onExit={goLobby} />;
  } else {
    content = <GameApp key={`${mode}-${runId}`} store={store} mode={mode} onExit={goLobby} />;
  }
  return (
    <>
      {content}
      {!noticeAgreed && (
        <FanNotice
          onAgree={() => {
            try { localStorage.setItem(FAN_NOTICE_KEY, "1"); } catch { /* storage unavailable */ }
            setNoticeAgreed(true);
          }}
        />
      )}
    </>
  );
}
