import type { Champion, RosterDataset } from "./types";

export interface DataStore {
  dataset: RosterDataset;
  champions: Map<number, Champion>;
  season1: Champion[];
}

export interface LoadProgress {
  loaded: number;
  total: number;
  done: boolean;
}

export async function loadGameData(onProgress?: (progress: LoadProgress) => void): Promise<DataStore> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/roster.json`);
  if (!response.ok) throw new Error(`角色数据加载失败：HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length") ?? 0);
  let dataset: RosterDataset;
  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ loaded, total, done: false });
    }
    const merged = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    onProgress?.({ loaded, total, done: true });
    dataset = JSON.parse(new TextDecoder().decode(merged)) as RosterDataset;
  } else {
    dataset = (await response.json()) as RosterDataset;
    onProgress?.({ loaded: total, total, done: true });
  }
  const champions = new Map<number, Champion>();
  for (const champion of dataset.characters) champions.set(champion.id, champion);
  const season1 = dataset.seasons.season1
    .map((id) => champions.get(id))
    .filter((c): c is Champion => Boolean(c));
  return { dataset, champions, season1 };
}

export function assetUrl(path: string | null | undefined): string {
  if (!path) return "";
  return `${import.meta.env.BASE_URL}${path}`;
}

export function raceName(store: DataStore, race: number): string {
  return store.dataset.constants.races[String(race)]?.name ?? `种族${race}`;
}

export function raceColor(store: DataStore, race: number): string {
  return store.dataset.constants.races[String(race)]?.color ?? "#8896ab";
}

export function className(store: DataStore, classType: number): string {
  return store.dataset.constants.classes[String(classType)]?.name ?? `职业${classType}`;
}

export function roleName(store: DataStore, role: string): string {
  return store.dataset.constants.roles[role]?.name ?? role;
}

export function roleColor(store: DataStore, role: string): string {
  return store.dataset.constants.roles[role]?.color ?? "#8896ab";
}

export function elementNames(store: DataStore, mask: number): string[] {
  const result: string[] = [];
  for (const bit of [2, 4, 8, 16, 32]) {
    if ((mask & bit) !== 0) result.push(store.dataset.constants.elements[String(bit)]?.name ?? String(bit));
  }
  return result.length ? result : ["无"];
}

export function primaryElement(mask: number): number {
  for (const bit of [2, 4, 8, 16, 32]) if ((mask & bit) !== 0) return bit;
  return 1;
}
