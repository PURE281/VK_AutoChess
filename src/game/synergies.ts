import type { Champion, PlayerState, TraitState } from "../types";
import { primaryElement } from "../data";
import { ELEMENT_TRAITS, RACE_TRAITS, ROLE_TRAITS } from "./definitions";

export interface CombatTraitLevels {
  races: Record<number, number>;
  roles: Record<string, number>;
  elements: Record<number, number>;
}

export function uniqueBoardChampions(player: PlayerState, champions: Map<number, Champion>): Champion[] {
  const seen = new Set<number>();
  const result: Champion[] = [];
  for (const unit of Object.values(player.board)) {
    if (seen.has(unit.championId)) continue;
    const champion = champions.get(unit.championId);
    if (!champion) continue;
    seen.add(unit.championId);
    result.push(champion);
  }
  return result;
}

function activeLevel(count: number, breakpoints: number[]): number {
  let level = 0;
  for (const point of breakpoints) if (count >= point) level += 1;
  return level;
}

export function computeTraits(player: PlayerState, champions: Map<number, Champion>, names: {
  races: Record<string, { name: string; color: string }>;
  roles: Record<string, { name: string; color: string }>;
  elements: Record<string, { name: string; color: string }>;
}): TraitState[] {
  const board = uniqueBoardChampions(player, champions);
  const raceCounts = new Map<number, number>();
  const roleCounts = new Map<string, number>();
  const elementCounts = new Map<number, number>();
  for (const champion of board) {
    raceCounts.set(champion.race, (raceCounts.get(champion.race) ?? 0) + 1);
    roleCounts.set(champion.role, (roleCounts.get(champion.role) ?? 0) + 1);
    const element = primaryElement(champion.elementMask);
    if (element !== 1 && element !== 64) elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
  }
  const traits: TraitState[] = [];
  for (const def of RACE_TRAITS) {
    const count = raceCounts.get(def.race) ?? 0;
    if (!count) continue;
    const meta = names.races[String(def.race)] ?? { name: `种族${def.race}`, color: "#8896ab" };
    traits.push({
      key: `race:${def.race}`,
      name: meta.name,
      color: meta.color,
      count,
      activeLevel: activeLevel(count, def.breakpoints),
      breakpoints: def.breakpoints,
      description: def.description,
    });
  }
  for (const def of ROLE_TRAITS) {
    const count = roleCounts.get(def.role) ?? 0;
    if (!count) continue;
    const meta = names.roles[def.role] ?? { name: def.role, color: "#8896ab" };
    traits.push({
      key: `role:${def.role}`,
      name: meta.name,
      color: meta.color,
      count,
      activeLevel: activeLevel(count, def.breakpoints),
      breakpoints: def.breakpoints,
      description: def.description,
    });
  }
  for (const def of ELEMENT_TRAITS) {
    const count = elementCounts.get(def.element) ?? 0;
    if (!count) continue;
    const meta = names.elements[String(def.element)] ?? { name: `元素${def.element}`, color: "#8896ab" };
    traits.push({
      key: `element:${def.element}`,
      name: meta.name,
      color: meta.color,
      count,
      activeLevel: activeLevel(count, def.breakpoints),
      breakpoints: def.breakpoints,
      description: def.description,
    });
  }
  return traits.sort((a, b) => (b.activeLevel - a.activeLevel) || (b.count - a.count) || a.name.localeCompare(b.name, "zh-CN"));
}

export function combatTraitLevels(player: PlayerState, champions: Map<number, Champion>): CombatTraitLevels {
  const board = uniqueBoardChampions(player, champions);
  const raceCounts = new Map<number, number>();
  const roleCounts = new Map<string, number>();
  const elementCounts = new Map<number, number>();
  for (const champion of board) {
    raceCounts.set(champion.race, (raceCounts.get(champion.race) ?? 0) + 1);
    roleCounts.set(champion.role, (roleCounts.get(champion.role) ?? 0) + 1);
    const element = primaryElement(champion.elementMask);
    if (element !== 1 && element !== 64) elementCounts.set(element, (elementCounts.get(element) ?? 0) + 1);
  }
  const races: Record<number, number> = {};
  const roles: Record<string, number> = {};
  const elements: Record<number, number> = {};
  for (const def of RACE_TRAITS) races[def.race] = activeLevel(raceCounts.get(def.race) ?? 0, def.breakpoints);
  for (const def of ROLE_TRAITS) roles[def.role] = activeLevel(roleCounts.get(def.role) ?? 0, def.breakpoints);
  for (const def of ELEMENT_TRAITS) elements[def.element] = activeLevel(elementCounts.get(def.element) ?? 0, def.breakpoints);
  return { races, roles, elements };
}
