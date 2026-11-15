import type { CacheAdapter, CacheEntry } from "./types.mjs";

// The ioredis signatures.
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  scan(
    cursor: string,
    match: "MATCH",
    pattern: string,
    count: "COUNT",
    n: number,
  ): Promise<[cursor: string, keys: string[]]>;
}

export function redisCache(client: RedisLike, prefix = "http:"): CacheAdapter {
  // SCAN patterns are globs, so a prefix such as "api[1]:" must be escaped to match itself.
  const pattern = `${prefix.replace(/[*?[\]\\]/g, "\\$&")}*`;
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
    async clear() {
      // With no prefix the pattern is "*", which would delete everything else in the database too.
      if (!prefix) throw new Error("redisCache: clear() needs a prefix");
      let cursor = "0";
      do {
        const [next, keys] = await client.scan(cursor, "MATCH", pattern, "COUNT", 500);
        if (keys.length > 0) await client.del(...keys);
        cursor = next;
      } while (cursor !== "0");
    },
  };
}
