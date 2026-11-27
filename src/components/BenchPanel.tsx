import type { Champion, LocationRef, PlayerState } from "../types";
import type { DataStore } from "../data";
import { assetUrl, raceColor, roleColor } from "../data";
import { sameLocation, starProgress } from "../game/roster";
import { longPressHandlers } from "../hooks/longPress";

interface BenchPanelProps {
  store: DataStore;
  player: PlayerState;
  selected: LocationRef | null;
  onLocationClick: (loc: LocationRef) => void;
  onInspect: (championId: number, popup?: boolean) => void;
}

function stars(star: number): string {
  return "★".repeat(star);
}

export default function BenchPanel({ store, player, selected, onLocationClick, onInspect }: BenchPanelProps) {
  return (
    <section className="panel bench-panel">
      <div className="panel-title-row">
        <h2>备战席</h2>
        <span>{player.bench.filter(Boolean).length}/9</span>
      </div>
      <div className="bench-grid">
        {player.bench.map((unit, index) => {
          const loc: LocationRef = { type: "bench", index };
          const champion = unit ? store.champions.get(unit.championId) : undefined;
          const isSelected = selected ? sameLocation(selected, loc) : false;
          const progress = unit ? starProgress(player, unit.championId) : null;
          const popupInspect = champion ? longPressHandlers(() => onInspect(champion.id, true)) : {};
          return (
            <button
              key={index}
              {...popupInspect}
              className={`bench-slot ${unit ? "filled" : ""} ${isSelected ? "selected" : ""}`}
              onClick={() => onLocationClick(loc)}
              onMouseEnter={() => champion && onInspect(champion.id)}
              title={champion ? `${champion.name} · 点击选择/交换` : "空备战位"}
            >
              {unit && champion ? (
                <>
                  <img src={assetUrl(champion.assets.icon)} alt={champion.name} draggable={false} />
                  <span className={`unit-stars star-${unit.star}`}>{stars(unit.star)}</span>
                  {unit.items.length > 0 && <span className="item-dot-count">{unit.items.length}</span>}
                  <span className="bench-name">{champion.name}</span>
                  {progress?.nextStar && <span className={`bench-progress ${progress.readyAfterOne ? "ready" : ""}`}>{progress.baseCopies}/{progress.needed}</span>}
                  <span className="trait-mini" style={{ borderColor: raceColor(store, champion.race) }} />
                  <span className="trait-mini role" style={{ borderColor: roleColor(store, champion.role) }} />
                </>
              ) : (
                <span className="empty-plus">+</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
