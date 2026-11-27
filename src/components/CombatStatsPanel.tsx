import { useEffect, useMemo, useRef, useState } from "react";
import type { ActiveCombat } from "../types";
import type { DataStore } from "../data";
import { assetUrl } from "../data";

interface CombatStatsPanelProps {
  store: DataStore;
  combat: ActiveCombat;
  speed: number;
}

export default function CombatStatsPanel({ store, combat, speed }: CombatStatsPanelProps) {
  const [time, setTime] = useState(0);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const combatKey = `${combat.round}:${combat.opponentId}:${combat.startedAt}:${combat.result.duration}:${combat.result.frames.length}`;

  useEffect(() => {
    setTime(0);
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = ((now - last) / 1000) * speedRef.current;
      last = now;
      setTime((current) => Math.min(combat.result.duration + 0.2, current + dt));
    }, 90);
    return () => window.clearInterval(timer);
  }, [combatKey, combat.result.duration]);

  const rows = useMemo(() => {
    const damage: Record<number, number> = {};
    const healing: Record<number, number> = {};
    for (const event of combat.result.events) {
      if (event.t > time || event.source == null || !event.amount) continue;
      if (event.type === "damage") damage[event.source] = (damage[event.source] ?? 0) + event.amount;
      if (event.type === "heal") healing[event.source] = (healing[event.source] ?? 0) + event.amount;
    }
    const ids = new Set([...Object.keys(damage), ...Object.keys(healing)]);
    return Array.from(ids)
      .map((id) => {
        const numericId = Number(id);
        const label = combat.result.unitLabels[numericId];
        const champion = label ? store.champions.get(label.championId) : undefined;
        return { id: numericId, damage: damage[numericId] ?? 0, healing: healing[numericId] ?? 0, label, champion };
      })
      .filter((row) => row.label && row.champion)
      .sort((a, b) => (b.damage + b.healing * 0.72) - (a.damage + a.healing * 0.72));
  }, [combat, store, time]);

  const visibleRows = rows.slice(0, 8);
  const maxDamage = Math.max(1, ...visibleRows.map((row) => row.damage));
  const playerDamage = rows.filter((row) => row.label?.side === "player").reduce((sum, row) => sum + row.damage, 0);
  const enemyDamage = rows.filter((row) => row.label?.side === "enemy").reduce((sum, row) => sum + row.damage, 0);
  const playerHealing = rows.filter((row) => row.label?.side === "player").reduce((sum, row) => sum + row.healing, 0);
  const enemyHealing = rows.filter((row) => row.label?.side === "enemy").reduce((sum, row) => sum + row.healing, 0);
  return (
    <section className="panel combat-stats-panel">
      <div className="panel-title-row">
        <h2>实时输出</h2>
        <span>{time.toFixed(1)}s / {combat.result.duration.toFixed(1)}s</span>
      </div>
      <div className="damage-summary">
        <div><span>我方伤害</span><strong>{Math.round(playerDamage)}</strong></div>
        <div><span>我方治疗</span><strong className="healing-total">{Math.round(playerHealing)}</strong></div>
        <div><span>敌方伤害</span><strong>{Math.round(enemyDamage)}</strong></div>
        <div><span>敌方治疗</span><strong className="healing-total">{Math.round(enemyHealing)}</strong></div>
      </div>
      <div className="damage-rows">
        {visibleRows.length === 0 && <div className="muted empty-damage">战斗刚刚开始，正在统计输出……</div>}
        {visibleRows.map((row) => (
          <div key={row.id} className={`damage-row ${row.label?.side}`}>
            <img src={assetUrl(row.champion?.assets.icon)} alt="" draggable={false} />
            <div className="damage-copy">
              <div className="damage-name"><span>{row.label?.name}</span><em>{Math.round(row.damage)}</em></div>
              <div className="damage-track"><i style={{ width: `${(row.damage / maxDamage) * 100}%` }} /></div>
              {row.healing > 1 && <small>治疗 {Math.round(row.healing)}</small>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
