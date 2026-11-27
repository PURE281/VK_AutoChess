import { useState } from "react";
import type { PlayerState } from "../types";
import type { DataStore } from "../data";
import { computeTraits } from "../game/synergies";
import { traitDetail } from "../game/traitDetails";

interface TraitPanelProps {
  store: DataStore;
  player: PlayerState;
}

interface TooltipState {
  key: string;
  x: number;
  y: number;
}

export default function TraitPanel({ store, player }: TraitPanelProps) {
  const traits = computeTraits(player, store.champions, {
    races: store.dataset.constants.races,
    roles: store.dataset.constants.roles,
    elements: store.dataset.constants.elements,
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipTrait = tooltip ? traits.find((trait) => trait.key === tooltip.key) : null;
  const tooltipDetail = tooltip ? traitDetail(tooltip.key) : null;

  const showTooltip = (key: string, x: number, y: number) => setTooltip({ key, x, y });
  const moveTooltip = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!tooltip) return;
    setTooltip({ ...tooltip, x: event.clientX, y: event.clientY });
  };
  const focusTooltip = (key: string, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    setTooltip({ key, x: rect.right + 4, y: rect.top });
  };
  const tooltipWidth = 330;
  const tooltipHeight = 300;
  const tooltipLeft = tooltip ? Math.max(8, Math.min(tooltip.x + 14, window.innerWidth - tooltipWidth - 8)) : 0;
  const tooltipTop = tooltip ? Math.max(8, Math.min(tooltip.y + 14, window.innerHeight - tooltipHeight - 8)) : 0;

  return (
    <section className="panel traits-panel">
      <div className="panel-title-row">
        <h2>羁绊</h2>
        <span>{traits.filter((t) => t.activeLevel > 0).length} 激活</span>
      </div>
      <div className="trait-list">
        {traits.length === 0 && <div className="muted">上阵棋子后，这里会显示种族与职业羁绊。</div>}
        {traits.map((trait) => {
          const nextBreakpoint = trait.breakpoints.find((point) => point > trait.count);
          const stateText = trait.activeLevel > 0
            ? `${trait.activeLevel} 阶已激活${nextBreakpoint ? ` · 距下一阶 ${nextBreakpoint - trait.count}` : " · 已满阶"}`
            : nextBreakpoint ? `未激活 · 还差 ${nextBreakpoint - trait.count}` : "未激活";
          return (
            <div
              key={trait.key}
              className={`trait-row level-${trait.activeLevel}`}
              tabIndex={0}
              onMouseEnter={(event) => showTooltip(trait.key, event.clientX, event.clientY)}
              onMouseMove={moveTooltip}
              onMouseLeave={() => setTooltip(null)}
              onFocus={(event) => focusTooltip(trait.key, event.currentTarget)}
              onBlur={() => setTooltip(null)}
            >
              <span className="trait-gem" style={{ background: trait.color }} />
              <div className="trait-copy">
                <div className="trait-name-line">
                  <strong style={{ color: trait.activeLevel ? trait.color : undefined }}>{trait.name}</strong>
                  <span>{trait.count}/{trait.breakpoints[Math.min(trait.activeLevel, trait.breakpoints.length - 1)]}</span>
                </div>
                <div className="trait-breaks">
                  {trait.breakpoints.map((point) => (
                    <i key={point} className={trait.count >= point ? "on" : ""}>{point}</i>
                  ))}
                </div>
                <div className="trait-state-text">{stateText}</div>
              </div>
            </div>
          );
        })}
      </div>
      {tooltip && tooltipTrait && tooltipDetail && (
        <div className="trait-tooltip-fixed" style={{ left: tooltipLeft, top: tooltipTop, width: tooltipWidth }}>
          <div className="trait-tooltip-head">
            <span className="trait-gem" style={{ background: tooltipTrait.color }} />
            <strong>{tooltipTrait.name}</strong>
            <em>{tooltipTrait.activeLevel ? `${tooltipTrait.activeLevel} 阶激活` : "未激活"}</em>
          </div>
          <p>{tooltipDetail.summary}</p>
          <div className="trait-tooltip-count">当前场上唯一单位：{tooltipTrait.count} 个</div>
          <ul>
            {tooltipDetail.levels.map((line, index) => (
              <li key={line} className={index + 1 === tooltipTrait.activeLevel ? "current" : index + 1 < tooltipTrait.activeLevel ? "passed" : ""}>
                {line}
              </li>
            ))}
          </ul>
          {tooltipDetail.note && <div className="trait-tooltip-note">{tooltipDetail.note}</div>}
        </div>
      )}
    </section>
  );
}
