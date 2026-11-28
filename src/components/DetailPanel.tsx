import { useState } from "react";
import type { GameAction } from "../game/engine";
import type { Champion, LocationRef, PlayerState } from "../types";
import type { DataStore } from "../data";
import { assetUrl, className, elementNames, raceColor, raceName, roleColor, roleName } from "../data";
import { itemById } from "../game/definitions";
import { deployLimit, firstEmptyBench, firstEmptyBoard, getUnitAt, sellValue, starProgress } from "../game/roster";
import { costumeOptions, customSkinKey, customSkinOptions, getSkin, setSkin } from "../skins";

interface DetailPanelProps {
  store: DataStore;
  player: PlayerState;
  selected: LocationRef | null;
  inspectedChampionId: number | null;
  inspectedItemId?: string | null;
  dispatch: (action: GameAction) => void;
  clearSelection: () => void;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function DetailPanel({ store, player, selected, inspectedChampionId, inspectedItemId, dispatch, clearSelection }: DetailPanelProps) {
  const [, setSkinTick] = useState(0);
  const selectedUnit = selected ? getUnitAt(player, selected) : null;
  const selectedChampion = selectedUnit ? store.champions.get(selectedUnit.championId) : null;
  const inspectedChampion = inspectedChampionId != null ? store.champions.get(inspectedChampionId) : null;
  const champion: Champion | undefined = selectedChampion ?? inspectedChampion ?? undefined;

  if (inspectedItemId) {
    const item = itemById(inspectedItemId);
    return (
      <section className="panel detail-panel item-detail-panel">
        <div className="panel-title-row"><h2>神器详情</h2><span>{item.tags.join(" · ")}</span></div>
        <div className="item-detail-hero">
          <div className="item-detail-icon">{item.icon}</div>
          <div>
            <h3>{item.name}</h3>
            <p>{item.description}</p>
          </div>
        </div>
        <div className="skill-card item-effect-card">
          <div className="skill-title"><span>装备效果</span><strong>实战规则</strong></div>
          <p>{item.description}</p>
          <div className="skill-metrics">
            <span>类型 {item.tags.includes("offense") ? "进攻" : item.tags.includes("defense") ? "防御" : item.tags.includes("support") ? "辅助" : "控制"}</span>
            <span>上限 2 件/英灵</span>
          </div>
        </div>
        <div className="item-usage-box">
          <span className="section-label">使用方式</span>
          <p>点击神器栏中的神器，再点击棋盘或备战席中的英灵即可装备。已装备后可在英灵详情中点击卸下。神器效果会在战斗模拟中实时生效。</p>
        </div>
      </section>
    );
  }

  if (!champion) {
    return (
      <section className="panel detail-panel empty-detail">
        <div className="panel-title-row"><h2>英灵详情</h2></div>
        <div className="detail-placeholder">
          <div className="rune-circle">ᛟ</div>
          <h3>选择一名英灵</h3>
          <p>点击棋盘、备战席或商店卡牌查看属性、技能与神器。再次点击其他位置即可移动棋子。</p>
          <ul>
            <li>空格：开始战斗</li>
            <li>R：刷新商店</li>
            <li>F：购买经验</li>
            <li>Esc：取消选择</li>
          </ul>
        </div>
      </section>
    );
  }

  const statRows: Array<[string, number]> = [
    ["生命", champion.statShape.hp],
    ["物攻", champion.statShape.physical_attack],
    ["魔攻", champion.statShape.magic_attack],
    ["物防", champion.statShape.physical_defense],
    ["魔防", champion.statShape.magic_defense],
    ["敏捷", champion.statShape.agility],
  ];
  const progress = starProgress(player, champion.id);
  const canSell = Boolean(selected && selectedUnit);
  const emptyBench = firstEmptyBench(player);
  const emptyBoard = firstEmptyBoard(player);
  const canRecall = selected?.type === "board" && emptyBench >= 0;
  const canDeploy = selected?.type === "bench" && emptyBoard && player.board && Object.keys(player.board).length < deployLimit(player);

  return (
    <section className="panel detail-panel">
      <div className="panel-title-row">
        <h2>英灵详情</h2>
        {selectedUnit && <span className={`unit-stars star-${selectedUnit.star}`}>{"★".repeat(selectedUnit.star)}</span>}
      </div>
      <div className="detail-hero">
        <div className="standing-frame">
          <img src={assetUrl((() => { const sc = getSkin(store.costumes, champion.id); return (typeof sc === "number" ? store.champions.get(sc) : undefined) ?? champion; })().assets.standing)} alt={champion.name} draggable={false} />
        </div>
        <div className="detail-heading">
          <h3>{champion.name}</h3>
          <div className="detail-tags">
            <span style={{ color: raceColor(store, champion.race) }}>{raceName(store, champion.race)}</span>
            <span style={{ color: roleColor(store, champion.role) }}>{roleName(store, champion.role)}</span>
            <span>{className(store, champion.classType)}</span>
            <span>{elementNames(store, champion.elementMask).join("/")}</span>
          </div>
          <div className={`cost-large cost-${champion.cost}`}>{champion.cost} 费</div>
        </div>
      </div>

      {(() => {
        const options = costumeOptions(store.costumes, champion.id);
        if (options.length < 2 && customSkinOptions(store.customSkins, champion.id).length === 0) return null;
        const active = getSkin(store.costumes, champion.id);
        return (
          <div className="skin-picker">
            <span className="section-label">外观（纯皮肤，不影响数值）</span>
            <div className="skin-options">
              {options.map((cid) => {
                const skinChampion = store.champions.get(cid);
                if (!skinChampion) return null;
                return (
                  <button
                    key={cid}
                    className={`skin-option${cid === active ? " active" : ""}`}
                    title={skinChampion.name}
                    onClick={() => {
                      setSkin(store.costumes, champion.id, cid);
                      setSkinTick((v) => v + 1);
                    }}
                  >
                    <img src={assetUrl(skinChampion.assets.icon)} alt={skinChampion.name} draggable={false} />
                  </button>
                );
              })}
              {customSkinOptions(store.customSkins, champion.id).map((def) => {
                const key = customSkinKey(champion.id, def.key);
                return (
                  <button
                    key={key}
                    className={`skin-option custom${key === active ? " active" : ""}`}
                    title={`${def.name}${def.author ? ` · ${def.author}` : ""}（自定义皮肤）`}
                    onClick={() => {
                      setSkin(store.costumes, champion.id, key);
                      setSkinTick((v) => v + 1);
                    }}
                  >
                    <img src={assetUrl(def.icon ?? champion.assets.icon)} alt={def.name} draggable={false} />
                    <span className="skin-custom-badge">自</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="skill-card">
        <div className="skill-title"><span>必杀技</span><strong>{champion.skill.name}</strong></div>
        <p>{champion.skill.description || champion.skill.characterDetail || "这位英灵的技能记录散落在世界树残页中，战斗时仍会依其定位施展力量。"}</p>
        <div className="skill-metrics">
          <span>伤害 {champion.skill.damage || "—"}</span>
          <span>治疗 {champion.skill.heal || "—"}</span>
          <span>段数 {champion.skill.hits || 1}</span>
        </div>
      </div>

      {selectedUnit && (
        <div className="starup-panel">
          <div className="starup-title">
            <span>升星进度</span>
            {progress.nextStar ? <strong>★{progress.nextStar} {Math.min(progress.baseCopies, progress.needed)}/{progress.needed}</strong> : <strong>已达 ★3</strong>}
          </div>
          <div className="starup-track"><i style={{ width: `${progress.nextStar ? Math.min(100, (progress.baseCopies / progress.needed) * 100) : 100}%` }} /></div>
          <p>{progress.nextStar ? `相同角色会自动三合一。当前按一星等效计 ${progress.baseCopies} 张，达到 ${progress.needed} 张后升为 ★${progress.nextStar}。` : "这名英灵已经升至最高星级。"}</p>
        </div>
      )}

      <div className="stat-grid">
        {statRows.map(([label, value]) => (
          <div key={label} className="stat-row">
            <span>{label}</span>
            <div><i style={{ width: `${Math.max(8, Math.min(100, value * 72))}%` }} /></div>
            <em>{pct(value)}</em>
          </div>
        ))}
      </div>

      {selectedUnit && (
        <div className="equipped-items">
          <span className="section-label">已装备</span>
          {selectedUnit.items.length === 0 && <span className="muted">无神器</span>}
          {selectedUnit.items.map((itemId, index) => {
            const item = itemById(itemId);
            return (
              <button key={`${itemId}-${index}`} className="equipped-item" title="点击卸下" onClick={() => selected && dispatch({ type: "UNEQUIP_ITEM", loc: selected, itemIndex: index })}>
                <b>{item.icon}</b>{item.name}
              </button>
            );
          })}
        </div>
      )}

      {canSell && selected && selectedUnit && (
        <div className="detail-actions">
          {canRecall && (
            <button onClick={() => {
              dispatch({ type: "MOVE_UNIT", from: selected, to: { type: "bench", index: emptyBench } });
              clearSelection();
            }}>召回备战席</button>
          )}
          {canDeploy && emptyBoard && (
            <button onClick={() => {
              dispatch({ type: "MOVE_UNIT", from: selected, to: emptyBoard });
              clearSelection();
            }}>自动上阵</button>
          )}
          <button className="danger" onClick={() => {
            dispatch({ type: "SELL_UNIT", loc: selected });
            clearSelection();
          }}>出售 +{sellValue(champion, selectedUnit.star)}金</button>
        </div>
      )}
    </section>
  );
}
