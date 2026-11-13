import type { CacheAdapter, CacheEntry } from "./types.mjs";

const STORE = "responses";

interface StoredEntry {
  entry: CacheEntry;
  expiresAt: number;
}

export function indexedDbCache(dbName = "create-http-cache"): CacheAdapter {
  let dbPromise: Promise<IDBDatabase> | undefined;

  function open(): Promise<IDBDatabase> {
    dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close(); // let another tab upgrade; we reopen on the next call
          dbPromise = undefined;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    }).catch((err: unknown) => {
      dbPromise = undefined; // don't cache a failed open forever
      throw err;
    });
    return dbPromise;
  }

  async function run<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  return {
    async get(key) {
      const hit = await run<StoredEntry | undefined>("readonly", (s) => s.get(key));
      if (!hit) return undefined;
      if (Date.now() > hit.expiresAt) {
        await run("readwrite", (s) => s.delete(key));
        return undefined;
      }
      return hit.entry;
    },
    async set(key, entry, ttlMs) {
      const value: StoredEntry = { entry, expiresAt: Date.now() + ttlMs };
      await run("readwrite", (s) => s.put(value, key));
    },
    async delete(key) {
      await run("readwrite", (s) => s.delete(key));
    },
  };
}
