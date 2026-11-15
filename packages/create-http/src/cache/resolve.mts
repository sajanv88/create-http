import { hasIndexedDB } from "../runtime.mjs";
import { indexedDbCache } from "./indexeddb.mjs";
import { memoryCache } from "./memory.mjs";
import type { CacheAdapter, CacheOptions } from "./types.mjs";

// Off unless asked for. A response can belong to one user through a cookie the client never
// sees, so no store is safe to turn on by default.
export function resolveCache(option: CacheOptions): CacheAdapter | undefined {
  if (option === false || option === undefined) return undefined;
  if (option && typeof option === "object") return option; // custom adapter, e.g. redisCache(client)
  if (option === "memory") return memoryCache();
  if (option === "indexeddb") {
    if (!hasIndexedDB)
      throw new Error('cache: "indexeddb" needs IndexedDB, which this runtime lacks');
    return indexedDbCache();
  }
  return undefined;
}
