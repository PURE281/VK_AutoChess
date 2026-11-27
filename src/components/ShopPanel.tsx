import type { GameAction } from "../game/engine";
import type { PlayerState } from "../types";
import type { DataStore } from "../data";
import { assetUrl, elementNames, raceColor, raceName, roleColor, roleName } from "../data";
import { SHOP_ODDS } from "../game/definitions";
import { boardCount, canAcquireUnit, deployLimit, firstEmptyBench, starProgress } from "../game/roster";
import { longPressHandlers } from "../hooks/longPress";

interface ShopPanelProps {
  store: DataStore;
  player: PlayerState;
  pool: Record<number, number>;
  phase: string;
  dispatch: (action: GameAction) => void;
  onInspect: (championId: number, popup?: boolean) => void;
}

function costClass(cost: number): string {
  return `cost-${cost}`;
}

export default function ShopPanel({ store, player, pool, phase, dispatch, onInspect }: ShopPanelProps) {
  const planning = phase === "planning";
  const odds = SHOP_ODDS[Math.min(9, Math.max(1, player.level))] ?? SHOP_ODDS[1];
  const rerollCost = player.augments.includes("cheap_refresh") ? 1 : 2;
  const freeReroll = player.freeRerolls > 0;
  const benchFull = firstEmptyBench(player) < 0;
  return (
    <section className="panel shop-panel">
      <div className="shop-header">
        <div>
          <h2>英灵商店</h2>
          <div className="shop-odds">
            {odds.map((odd, index) => (
              <span key={index} className={`odd-chip cost-${index + 1}`}>{index + 1}费 {odd}%</span>
            ))}
          </div>
        </div>
        <div className="shop-actions">
          <button disabled={!planning || player.gold < 4} onClick={() => dispatch({ type: "BUY_XP" })}>研习 4xp<br /><small>4金</small></button>
          <button disabled={!planning || (!freeReroll && player.gold < rerollCost)} onClick={() => dispatch({ type: "REROLL" })}>刷新<br /><small>{freeReroll ? "免费" : `${rerollCost}金`}</small></button>
          <button disabled={!planning} className={player.shopLocked ? "active" : ""} onClick={() => dispatch({ type: "TOGGLE_LOCK" })}>锁定<br /><small>{player.shopLocked ? "已锁" : "未锁"}</small></button>
          <button className="start-combat" disabled={!planning || boardCount(player) === 0} onClick={() => dispatch({ type: "START_COMBAT" })}>
            开始战斗<br /><small>{boardCount(player)}/{deployLimit(player)}</small>
          </button>
        </div>
      </div>
      {benchFull && <div className="warning-line">备战席已满：只有能立即合成升星的棋子仍可购买</div>}
      <div className="shop-cards">
        {player.shop.map((slot, index) => {
          const champion = slot.championId ? store.champions.get(slot.championId) : undefined;
          if (!champion) {
            return <div key={index} className="shop-card empty"><span>已售出</span></div>;
          }
          const affordable = player.gold >= champion.cost;
          const remaining = pool[champion.id] ?? 0;
          const canAcquire = canAcquireUnit(player, champion.id);
          const progress = starProgress(player, champion.id);
          const popupInspect = longPressHandlers(() => onInspect(champion.id, true));
          return (
            <button
              key={`${champion.id}-${index}`}
              {...popupInspect}
              className={`shop-card ${costClass(champion.cost)} ${!affordable || !planning || !canAcquire ? "disabled" : ""}`}
              disabled={!planning || !affordable || !canAcquire}
              onClick={() => dispatch({ type: "BUY_UNIT", slot: index })}
              onMouseEnter={() => onInspect(champion.id)}
            >
              <div className="shop-card-top">
                <img src={assetUrl(champion.assets.icon)} alt={champion.name} draggable={false} />
                <div className="cost-badge">{champion.cost}</div>
                {progress.baseCopies > 0 && progress.nextStar && (
                  <div className={`star-progress-badge ${progress.readyAfterOne ? "ready" : ""}`}>
                    {progress.readyAfterOne ? `可升★${progress.nextStar}` : `★${progress.nextStar} ${progress.baseCopies}/${progress.needed}`}
                  </div>
                )}
              </div>
              <div className="shop-card-name">{champion.name}</div>
              <div className="shop-card-tags">
                <span style={{ color: raceColor(store, champion.race) }}>{raceName(store, champion.race)}</span>
                <span style={{ color: roleColor(store, champion.role) }}>{roleName(store, champion.role)}</span>
              </div>
              <div className="shop-card-elements">{elementNames(store, champion.elementMask).join(" · ")}</div>
              <div className="shop-card-bottom">
                <span>{champion.skill.name}</span>
                <small>余 {remaining}</small>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
