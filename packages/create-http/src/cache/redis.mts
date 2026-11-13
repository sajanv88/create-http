import type { CacheAdapter, CacheEntry } from "./types.mjs";

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>; // ioredis signature
  del(key: string): Promise<unknown>;
}

export function redisCache(client: RedisLike, prefix = "http:"): CacheAdapter {
  return {
    async get(key) {
      const raw = await client.get(prefix + key);
      return raw ? (JSON.parse(raw) as CacheEntry) : undefined;
    },
    async set(key, entry, ttlMs) {
      if (ttlMs <= 0) return; // Redis rejects PX 0, and the entry would be stale anyway
      ttlMs = Math.ceil(ttlMs); // PX must be an integer
      await client.set(prefix + key, JSON.stringify(entry), "PX", ttlMs); // Redis handles expiry
    },
    async delete(key) {
      await client.del(prefix + key);
    },
  };
}
