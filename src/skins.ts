// Cosmetic skin system. Two kinds of skins:
//  1. Costume variants - existing character ids sharing the same hero group
//     (public/data/costumes.json), hero-wide selection.
//  2. Custom player-made skins - texture overrides living in
//     public/assets/skins/<unitId>/<key>/ (manifest custom-skins.json),
//     keyed "cs:<unitId>:<key>" and valid only for that exact unit id.
// Skins change only the 3D model/standing art - never stats, traits or icons.

export interface CostumeData {
  version: number;
  groups: Record<string, number[]>;
  byUnit: Record<string, number[]>;
}

export interface CustomSkinDef {
  key: string;
  name: string;
  author: string;
  body: string;
  face?: string;
  icon?: string;
}

export interface CustomSkinData {
  version: number;
  skins: Record<string, CustomSkinDef[]>;
}

export type SkinChoice = number | string;

const STORAGE_KEY = "vk-autochess-skins";
const listeners = new Set<() => void>();

let cache: Record<string, SkinChoice> | null = null;

function readStorage(): Record<string, SkinChoice> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, SkinChoice>;
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

export async function loadCustomSkins(): Promise<CustomSkinData> {
  // The manifest lives with the skin assets so the skin-admin backend can update
  // it on R2 without a frontend redeploy.
  const { assetUrl } = await import("./config");
  const response = await fetch(assetUrl("assets/skins/manifest.json"));
  if (!response.ok) return { version: 1, skins: {} };
  return (await response.json()) as CustomSkinData;
}

/** Costume ids available for a unit, including the unit itself. Empty when the hero has no variant. */
export function costumeOptions(costumes: CostumeData, unitId: number): number[] {
  return costumes.byUnit[String(unitId)] ?? [];
}

/** Player-made texture skins created for this exact unit id. */
export function customSkinOptions(custom: CustomSkinData, unitId: number): CustomSkinDef[] {
  return custom.skins[String(unitId)] ?? [];
}

export function customSkinKey(unitId: number, key: string): string {
  return `cs:${unitId}:${key}`;
}

export function parseCustomSkinKey(choice: SkinChoice): { unitId: number; key: string } | null {
  if (typeof choice !== "string") return null;
  const m = /^cs:(\d+):(.+)$/.exec(choice);
  return m ? { unitId: Number(m[1]), key: m[2] } : null;
}

export function customSkinDef(custom: CustomSkinData, choice: SkinChoice): CustomSkinDef | null {
  const parsed = parseCustomSkinKey(choice);
  if (!parsed) return null;
  return (custom.skins[String(parsed.unitId)] ?? []).find((s) => s.key === parsed.key) ?? null;
}

// Costume-variant selections are hero-wide: every variant of the same hero
// shares one selection, keyed by the group's lowest id. Custom skins are
// model-specific and only apply when the rendered unit id matches.
function groupKey(costumes: CostumeData, unitId: number): string {
  const options = costumeOptions(costumes, unitId);
  return options.length ? String(Math.min(...options)) : String(unitId);
}

/** The skin currently chosen for a unit: a costume id, a "cs:..." custom key, or the unit itself. */
export function getSkin(costumes: CostumeData, unitId: number): SkinChoice {
  const options = costumeOptions(costumes, unitId);
  const stored = readStorage()[groupKey(costumes, unitId)];
  if (typeof stored === "string" && parseCustomSkinKey(stored)) return stored;
  if (typeof stored === "number" && options.includes(stored)) return stored;
  return unitId;
}

export function setSkin(costumes: CostumeData, unitId: number, skin: SkinChoice): void {
  const data = readStorage();
  data[groupKey(costumes, unitId)] = skin;
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
