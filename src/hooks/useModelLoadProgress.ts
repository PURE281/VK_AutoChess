import { useSyncExternalStore } from "react";

export interface ModelLoadSnapshot {
  active: number;
  bytesLoaded: number;
  bytesTotal: number;
  knownTotal: boolean;
}

interface Entry {
  loaded: number;
  total: number;
  done: boolean;
}

const entries = new Map<number, Entry>();
const listeners = new Set<() => void>();
let cachedSnapshot: ModelLoadSnapshot = { active: 0, bytesLoaded: 0, bytesTotal: 0, knownTotal: false };
let dirty = true;

function recompute(): ModelLoadSnapshot {
  if (!dirty) return cachedSnapshot;
  let active = 0;
  let bytesLoaded = 0;
  let bytesTotal = 0;
  let knownTotal = true;
  for (const entry of entries.values()) {
    if (entry.done) continue;
    active += 1;
    bytesLoaded += entry.loaded;
    if (entry.total > 0) bytesTotal += Math.max(entry.total, entry.loaded);
    else knownTotal = false;
  }
  cachedSnapshot = { active, bytesLoaded, bytesTotal, knownTotal: knownTotal && bytesTotal > 0 };
  dirty = false;
  return cachedSnapshot;
}

function emit() {
  dirty = true;
  for (const listener of listeners) listener();
}

export const modelLoadTracker = {
  begin(id: number) {
    const existing = entries.get(id);
    if (existing && !existing.done) return;
    entries.set(id, { loaded: 0, total: 0, done: false });
    emit();
  },
  progress(id: number, loaded: number, total: number) {
    const entry = entries.get(id);
    if (!entry || entry.done) return;
    entry.loaded = loaded;
    if (total > 0) entry.total = total;
    emit();
  },
  end(id: number) {
    const entry = entries.get(id);
    if (entry) entry.done = true;
    emit();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): ModelLoadSnapshot {
    return recompute();
  },
};

export function useModelLoadProgress(): ModelLoadSnapshot {
  return useSyncExternalStore(
    (listener) => modelLoadTracker.subscribe(listener),
    () => modelLoadTracker.snapshot(),
    () => modelLoadTracker.snapshot(),
  );
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${bytes}B`;
}
