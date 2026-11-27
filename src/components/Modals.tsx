import type { GameAction } from "../game/engine";
import type { GameState } from "../types";
import { augmentById, itemById } from "../game/definitions";

interface ChoiceModalProps {
  choices: string[];
  dispatch: (action: GameAction) => void;
}

export function AugmentModal({ choices, dispatch }: ChoiceModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="choice-modal">
        <div className="modal-kicker">神谕赐福</div>
        <h2>选择一个强化符文</h2>
        <p>符文会持续影响整局游戏。连败玩家会提前解锁并提高高阶符文出现率。</p>
        <div className="choice-grid">
          {choices.map((id) => {
            const augment = augmentById(id);
            return (
              <button key={id} className={`choice-card augment tier-${augment.tier}`} onClick={() => dispatch({ type: "CHOOSE_AUGMENT", id })}>
                <span className="choice-tier">T{augment.tier}</span>
                <strong>{augment.name}</strong>
                <p>{augment.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ItemModal({ choices, dispatch }: ChoiceModalProps) {
  return (
    <div className="modal-backdrop">
      <div className="choice-modal">
        <div className="modal-kicker item">战斗奖励</div>
        <h2>选择一件神器</h2>
        <p>神器会进入神器栏。之后点击神器，再点击一名棋子即可装备；连败时高品质神器出现率会提高。</p>
        <div className="choice-grid">
          {choices.map((id) => {
            const item = itemById(id);
            return (
              <button key={id} className={`choice-card item-choice tier-${item.tier}`} onClick={() => dispatch({ type: "CHOOSE_ITEM", id })}>
                <span className="choice-tier item-tier">T{item.tier}</span>
                <span className="choice-item-icon">{item.icon}</span>
                <strong>{item.name}</strong>
                <p>{item.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GameOverModal({ state, dispatch }: { state: GameState; dispatch: (action: GameAction) => void }) {
  const player = state.players[0];
  const placement = state.gameResult === "victory" ? 1 : state.players.filter((p) => p.alive).length + 1;
  return (
    <div className="modal-backdrop">
      <div className={`choice-modal gameover ${state.gameResult}`}>
        <div className="modal-kicker">{state.gameResult === "victory" ? "英灵殿加冕" : "旅途终结"}</div>
        <h2>{state.gameResult === "victory" ? "你赢得了女武神棋境" : `第 ${placement} 名`}</h2>
        <p>
          最终回合 {player.eliminatedRound ?? state.round} · 等级 {player.level} · 剩余金币 {player.gold} · 强化 {player.augments.length} 个
        </p>
        <div className="gameover-actions">
          <button className="primary-button" onClick={() => dispatch({ type: "NEW_GAME" })}>再战一局</button>
        </div>
      </div>
    </div>
  );
}
