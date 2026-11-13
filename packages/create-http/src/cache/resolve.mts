import { hasIndexedDB } from "../runtime.mjs";
import { indexedDbCache } from "./indexeddb.mjs";
import { memoryCache } from "./memory.mjs";
import type { CacheAdapter, CacheOptions } from "./types.mjs";

export function resolveCache(option: CacheOptions): CacheAdapter | undefined {
  if (option === false) return undefined; // explicitly off
  if (option && typeof option === "object") return option; // custom adapter, e.g. redisCache(client)
  if (option === "memory") return memoryCache();
  if (option === "indexeddb") {
    if (!hasIndexedDB)
      throw new Error('cache: "indexeddb" needs IndexedDB, which this runtime lacks');
    return indexedDbCache();
  }
  // undefined: runtime default
  return hasIndexedDB ? indexedDbCache() : undefined; // browser → IndexedDB, Node → off
}
