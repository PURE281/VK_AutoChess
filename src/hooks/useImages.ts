import { useEffect, useState } from "react";
import type { DataStore } from "../data";
import { assetUrl } from "../data";

type CacheEntry = {
  image: HTMLImageElement;
  loaded: boolean;
  callbacks: Set<() => void>;
};

const cache = new Map<string, CacheEntry>();

export function getCachedImage(path: string | null | undefined): HTMLImageElement | null {
  if (!path) return null;
  const key = assetUrl(path);
  const entry = cache.get(key);
  return entry?.loaded ? entry.image : null;
}

export function useSeasonImages(store: DataStore): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    const paths = new Set<string>();
    for (const champion of store.season1) {
      if (champion.assets.icon) paths.add(champion.assets.icon);
    }
    for (const path of paths) {
      const url = assetUrl(path);
      let entry = cache.get(url);
      if (!entry) {
        const image = new Image();
        entry = { image, loaded: false, callbacks: new Set() };
        cache.set(url, entry);
        image.onload = () => {
          const current = cache.get(url);
          if (current) current.loaded = true;
          current?.callbacks.forEach((cb) => cb());
        };
        image.onerror = () => {
          const current = cache.get(url);
          current?.callbacks.forEach((cb) => cb());
        };
        image.src = url;
      }
      if (!entry.loaded) {
        const cb = () => {
          if (alive) setVersion((v) => v + 1);
        };
        entry.callbacks.add(cb);
      }
    }
    return () => {
      alive = false;
    };
  }, [store]);
  return version;
}
