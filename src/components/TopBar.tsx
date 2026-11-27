import type { GameAction } from "../game/engine";
import type { GameState } from "../types";
import { XP_TO_NEXT } from "../game/definitions";
import { boardCount, deployLimit } from "../game/roster";
import { sound } from "../sound";
import { lossStreakGoldBonus, winStreakGoldBonus } from "../game/balance";
import { useState } from "react";

interface TopBarProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
  onExit?: () => void;
}

export default function TopBar({ state, dispatch, onExit }: TopBarProps) {
  const player = state.players[0];
  const xpNeed = XP_TO_NEXT[player.level] ?? 999;
  const xpPct = player.level >= 9 ? 100 : Math.min(100, (player.xp / Math.max(1, xpNeed)) * 100);
  const interestCap = player.augments.includes("gold_flow") ? 7 : 5;
  const interest = Math.min(interestCap, Math.floor(player.gold / 10));
  const winGold = winStreakGoldBonus(player.winStreak);
  const lossGold = lossStreakGoldBonus(player.lossStreak);
  const streakText = lossGold ? `连败补贴 +${lossGold}` : winGold ? `连胜奖励 +${winGold}` : null;
  const [soundOn, setSoundOn] = useState(sound.enabled);
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-rune">ᛉ</div>
        <div>
          <h1>女武神棋境</h1>
          <span>{state.mode === "trial" ? "世界树试炼 · 单人挑战" : state.mode === "pve" ? "单机棋境 · PVE" : "真人对决 · PVP"}</span>
        </div>
      </div>
      <div className="round-card">
        <span className="label">回合</span>
        <strong>{state.round}</strong>
        <em className={state.roundType}>{state.roundType === "pve" ? "试炼" : "PVP"}</em>
      </div>
      <div className="resource-strip">
        <div className="resource hp"><span>生命</span><strong>{player.hp}</strong><div><i style={{ width: `${player.hp}%` }} /></div></div>
        <div className="resource gold"><span>金币</span><strong>{player.gold}</strong><small>利息 +{interest}{streakText ? ` · ${streakText}` : ""}</small></div>
        <div className="resource xp"><span>等级 {player.level}</span><strong>{player.level >= 9 ? "MAX" : `${player.xp}/${xpNeed}`}</strong><div><i style={{ width: `${xpPct}%` }} /></div></div>
        <div className="resource units"><span>上阵</span><strong>{boardCount(player)}/{deployLimit(player)}</strong><small>{player.freeRerolls ? `免费刷新 ${player.freeRerolls}` : "备战 9 格"}</small></div>
      </div>
      <div className="top-actions">
        <div className="speed-control" title="战斗播放速度">
          {[1, 2, 3].map((speed) => (
            <button key={speed} className={state.combatSpeed === speed ? "active" : ""} onClick={() => dispatch({ type: "SET_COMBAT_SPEED", speed })}>{speed}x</button>
          ))}
        </div>
        <button className="ghost-button compact" onClick={() => setSoundOn(sound.toggle())}>{soundOn ? "音效开" : "音效关"}</button>
        <button className="ghost-button" onClick={() => dispatch({ type: "NEW_GAME" })}>重开本模式</button>
        {onExit && <button className="ghost-button" onClick={onExit}>回大厅</button>}
      </div>
    </header>
  );
}
