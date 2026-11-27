import { useEffect, useState } from "react";

export type DrawerKey = "top" | "left" | "right" | "bottom";
export type DrawerState = Record<DrawerKey, boolean>;

const combatState: DrawerState = { top: false, left: false, right: false, bottom: false };

/** Battlefield-first drawer visibility. Planning restores the resource/shop
 * drawers automatically; combat hides everything except the floating combat
 * output panel. Players can still manually open every drawer at any time. */
export function useImmersiveDrawers(phase: string, round: number) {
  const [drawers, setDrawers] = useState<DrawerState>({ top: true, left: false, right: false, bottom: true });
  useEffect(() => {
    if (phase === "combat") {
      setDrawers(combatState);
    } else if (phase === "planning") {
      setDrawers((current) => ({ ...current, top: true, bottom: true }));
    }
  }, [phase, round]);
  const toggleDrawer = (key: DrawerKey) => setDrawers((current) => ({ ...current, [key]: !current[key] }));
  return { drawers, toggleDrawer };
}
