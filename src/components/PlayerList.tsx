import type { PlayerState } from "../types";
import { boardCount, deployLimit } from "../game/roster";

interface PlayerListProps {
  players: PlayerState[];
  currentOpponentId?: number;
}

export default function PlayerList({ players, currentOpponentId }: PlayerListProps) {
  const sorted = players.slice().sort((a, b) => {
    if (a.isHuman) return -1;
    if (b.isHuman) return 1;
    if (a.alive !== b.alive) return a.alive ? -1 : 1;
    return b.hp - a.hp;
  });
  return (
    <section className="panel players-panel">
      <div className="panel-title-row">
        <h2>战局</h2>
        <span>{players.filter((p) => p.alive).length}/{players.length}</span>
      </div>
      <div className="player-list">
        {sorted.map((player) => (
          <div key={player.id} className={`player-row ${player.isHuman ? "human" : ""} ${!player.alive ? "dead" : ""} ${player.id === currentOpponentId ? "opponent" : ""}`}>
            <div className="player-mainline">
              <span className="player-name">{player.isHuman ? "你" : player.name}</span>
              <span className="player-level">Lv.{player.level}</span>
            </div>
            <div className="hp-track"><i style={{ width: `${player.hp}%` }} /></div>
            <div className="player-subline">
              <span>{player.hp} HP</span>
              <span>{boardCount(player)}/{deployLimit(player)} 棋子</span>
              <span>{player.winStreak >= 2 ? `${player.winStreak}连胜` : player.lossStreak >= 2 ? `${player.lossStreak}连败` : player.alive ? "—" : "淘汰"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
