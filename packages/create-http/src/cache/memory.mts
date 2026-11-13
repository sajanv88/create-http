import type { CacheAdapter, CacheEntry } from "./types.mjs";

// Least-recently-used: Map keeps insertion order, so re-inserting on access moves a key to the end.
export function memoryCache(maxEntries = 500): CacheAdapter {
  const store = new Map<string, { entry: CacheEntry; expiresAt: number }>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      store.delete(key);
      if (Date.now() > hit.expiresAt) return undefined;
      store.set(key, hit);
      return hit.entry;
    },
    async set(key, entry, ttlMs) {
      store.delete(key); // overwriting a key shouldn't evict a different one
      if (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, { entry, expiresAt: Date.now() + ttlMs });
    },
    async delete(key) {
      store.delete(key);
    },
  };
}
