import type { PlayerState } from "../types";
import { itemById } from "../game/definitions";

interface ItemBarProps {
  player: PlayerState;
  selectedItemIndex: number | null;
  onSelectItem: (index: number | null) => void;
  onInspectItem?: (itemId: string) => void;
}

export default function ItemBar({ player, selectedItemIndex, onSelectItem, onInspectItem }: ItemBarProps) {
  return (
    <section className="panel item-panel">
      <div className="panel-title-row">
        <h2>神器</h2>
        <span>{player.itemInventory.length}</span>
      </div>
      <div className="item-list">
        {player.itemInventory.length === 0 && <div className="muted empty-items">战斗奖励可获得神器</div>}
        {player.itemInventory.map((itemId, index) => {
          const item = itemById(itemId);
          const selected = selectedItemIndex === index;
          return (
            <button
              key={`${itemId}-${index}`}
              className={`item-token ${selected ? "selected" : ""}`}
              onClick={() => onSelectItem(selected ? null : index)}
              onMouseEnter={() => onInspectItem?.(itemId)}
              title={`T${item.tier} ${item.name}：${item.description}\n点击后再点击棋子装备或使用`}
            >
              <span className="item-icon">{item.icon}</span>
              <span>{item.name} <em className="item-tier-inline">T{item.tier}</em></span>
            </button>
          );
        })}
      </div>
      {selectedItemIndex != null && <div className="item-hint">已选中神器/消耗品：点击棋盘或备战席中的棋子装备或使用</div>}
    </section>
  );
}
