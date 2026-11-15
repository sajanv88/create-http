export interface CacheEntry {
  status: number;
  headers: [string, string][];
  body: string;
  storeAt: number;
}

export interface CacheAdapter {
  get(key: string): Promise<CacheEntry | undefined>;
  set(key: string, cacheEntry: CacheEntry, ttlMs: number): Promise<void>;
  delete(key: string): Promise<void>;
  /** Removes every entry this adapter stored. */
  clear(): Promise<void>;
}

export type CacheOptions = false | "memory" | "indexeddb" | CacheAdapter | undefined;
