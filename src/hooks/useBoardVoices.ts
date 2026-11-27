import { useEffect, useRef } from "react";
import type { UnitInstance } from "../types";
import { sound } from "../sound";

/** Play character join/retreat voice lines when the human planning board changes. */
export function useBoardVoices(board: Record<string, UnitInstance>): void {
  const previousRef = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const current = new Map(Object.values(board).map((unit) => [unit.uid, unit.championId]));
    const previous = previousRef.current;
    if (previous) {
      for (const [uid, championId] of current) {
        if (!previous.has(uid)) sound.deployVoice(championId);
      }
      for (const [uid, championId] of previous) {
        if (!current.has(uid)) sound.retreatVoice(championId);
      }
    }
    previousRef.current = current;
  }, [board]);
}
