import type { GameAction } from "../game/engine";
import type { PlayerState } from "../types";
import type { DataStore } from "../data";
import DetailPanel from "./DetailPanel";

interface ChampionInfoModalProps {
  store: DataStore;
  player: PlayerState;
  championId: number | null;
  dispatch: (action: GameAction) => void;
  onClose: () => void;
}

export default function ChampionInfoModal({ store, player, championId, dispatch, onClose }: ChampionInfoModalProps) {
  if (championId == null) return null;
  return (
    <div className="champion-info-backdrop" onClick={onClose}>
      <div className="champion-info-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="champion-info-close" onClick={onClose}>×</button>
        <DetailPanel
          store={store}
          player={player}
          selected={null}
          inspectedChampionId={championId}
          inspectedItemId={null}
          dispatch={dispatch}
          clearSelection={onClose}
        />
      </div>
    </div>
  );
}
