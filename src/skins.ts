// Cosmetic skin system: same hero costume variants share a group in
// public/data/costumes.json. Skins change only the 3D model and detail-panel
// standing art — unit stats, traits and icons are untouched.

export interface CostumeData {
  version: number;
  groups: Record<string, number[]>;
  byUnit: Record<string, number[]>;
}

const STORAGE_KEY = "vk-autochess-skins";
const listeners = new Set<() => void>();

let cache: Record<string, number> | null = null;

function readStorage(): Record<string, number> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, number>;
  } catch {
    cache = {};
  }
  return cache;
}

export async function loadCostumeData(): Promise<CostumeData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/costumes.json`);
  if (!response.ok) return { version: 1, groups: {}, byUnit: {} };
  return (await response.json()) as CostumeData;
}

/** Costume ids available for a unit, including the unit itself. Empty when the hero has no variant. */
export function costumeOptions(costumes: CostumeData, unitId: number): number[] {
  return costumes.byUnit[String(unitId)] ?? [];
}

// Skins are hero-wide: every costume variant of the same hero shares one
// selection, keyed by the group's lowest id. Otherwise setting a skin on a
// variant in the codex would not affect the base unit the player actually fields.
function groupKey(costumes: CostumeData, unitId: number): string {
  const options = costumeOptions(costumes, unitId);
  return options.length ? String(Math.min(...options)) : String(unitId);
}

/** The skin id currently chosen for a unit (defaults to the unit itself). */
export function getSkin(costumes: CostumeData, unitId: number): number {
  const options = costumeOptions(costumes, unitId);
  if (!options.length) return unitId;
  const stored = readStorage()[groupKey(costumes, unitId)];
  if (stored && options.includes(stored)) return stored;
  return unitId;
}

export function setSkin(costumes: CostumeData, unitId: number, skinId: number): void {
  const data = readStorage();
  data[groupKey(costumes, unitId)] = skinId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable - skins simply won't persist
  }
  for (const fn of listeners) fn();
}

/** Subscribe to skin changes (BoardCanvas3D rebuilds models). Returns unsubscribe. */
export function onSkinChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
