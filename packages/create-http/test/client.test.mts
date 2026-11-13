// Runs against the built package (dist/), exactly as consumers import it. `turbo run test` builds first.
// Node strips the types at run time; `pnpm check-types` type-checks this file (see test/tsconfig.json).
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, beforeEach, describe, test } from "node:test";
import {
  type CacheEntry,
  CircuitOpenError,
  createHttp,
  HttpError,
  type HttpResponse,
  memoryCache,
  type RetryOptions,
} from "create-http";

/** What the /echo route sends back. */
interface Echo {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body: unknown;
}

let base = "";
let hits: Record<string, number> = {};
let validToken = "new";

const server = http.createServer((req, res) => {
  const path = new URL(req.url ?? "/", "http://x").pathname;
  hits[path] = (hits[path] ?? 0) + 1;
  const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };
  let raw = "";
  req.on("data", (chunk: Buffer) => {
    raw += chunk;
  });
  req.on("end", () => {
    switch (path) {
      case "/v1/echo":
        return json(200, {
          method: req.method,
          url: req.url,
          headers: req.headers,
          body: raw ? JSON.parse(raw) : null,
        });
      case "/v1/count":
        return json(200, { n: hits[path] });
      case "/v1/no-store":
        return json(200, { n: hits[path] }, { "cache-control": "no-store" });
      case "/v1/empty":
        res.writeHead(204);
        return res.end();
      case "/v1/text":
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end("hello");
      case "/v1/down":
        return json(503, { error: "down" }, { "retry-after": "0" });
      case "/v1/me":
        return req.headers.authorization === `Bearer ${validToken}`
          ? json(200, { me: true })
          : json(401, { error: "unauthorized" });
      case "/v1/slow":
        return setTimeout(() => json(200, {}), 300);
      default:
        return json(404, { error: "not found" });
    }
  });
});

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});
after(() => server.close());
beforeEach(() => {
  hits = {};
});

const fast: Partial<RetryOptions> = { baseDelayMs: 1 };

describe("requests", () => {
  test("resolves against the base path, encodes the query and merges headers", async () => {
    const api = createHttp({ baseUrl: base, cache: false, headers: { "X-App": "test" } });
    const res = await api.get<Echo>("/echo", {
      query: { tag: ["a", "b"], page: 2, skip: undefined, none: null },
      headers: { "x-req": "1" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.statusText, "OK");
    assert.equal(res.data.url, "/v1/echo?tag=a&tag=b&page=2");
    assert.equal(res.data.headers["x-app"], "test");
    assert.equal(res.data.headers["x-req"], "1");
  });

  test("sends objects as JSON", async () => {
    const api = createHttp({ baseUrl: base, cache: false });
    const res = await api.post<Echo>("/echo", { name: "Ada" });
    assert.equal(res.data.method, "POST");
    assert.equal(res.data.headers["content-type"], "application/json");
    assert.deepEqual(res.data.body, { name: "Ada" });
  });

  test("parses empty and text responses", async () => {
    const api = createHttp({ baseUrl: base, cache: false });
    assert.equal((await api.get("/empty")).data, undefined);
    assert.equal((await api.get<string>("/text")).data, "hello");
  });

  test("throws HttpError with the parsed body for non-2xx", async () => {
    const api = createHttp({ baseUrl: base, cache: false });
    await assert.rejects(api.get("/missing"), (err: unknown) => {
      assert.ok(err instanceof HttpError);
      assert.equal(err.status, 404);
      assert.deepEqual(err.data, { error: "not found" });
      return true;
    });
  });
});

describe("timeouts and cancellation", () => {
  test("timeoutMs rejects with TimeoutError", async () => {
    const api = createHttp({ baseUrl: base, cache: false, retry: false });
    await assert.rejects(api.get("/slow", { timeoutMs: 50 }), { name: "TimeoutError" });
  });

  test("an aborted signal rejects with AbortError and isn't retried", async () => {
    const api = createHttp({ baseUrl: base, cache: false, retry: fast });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 30);
    await assert.rejects(api.get("/slow", { signal: controller.signal }), { name: "AbortError" });
    assert.equal(hits["/v1/slow"], 1);
  });
});

describe("retries", () => {
  // A function, not a constant: `base` is only known once the server is listening.
  const client = () =>
    createHttp({ baseUrl: base, cache: false, circuitBreaker: false, retry: fast });

  test("retries a GET on 503 up to the attempt limit", async () => {
    await assert.rejects(client().get("/down"), HttpError);
    assert.equal(hits["/v1/down"], 3);
  });

  test("doesn't retry POST by default", async () => {
    await assert.rejects(client().post("/down", {}), HttpError);
    assert.equal(hits["/v1/down"], 1);
  });

  test("retry: false turns retries off per request", async () => {
    await assert.rejects(client().get("/down", { retry: false }), HttpError);
    assert.equal(hits["/v1/down"], 1);
  });
});

describe("circuit breaker", () => {
  test("opens per origin after the threshold and fails fast", async () => {
    const api = createHttp({
      baseUrl: base,
      cache: false,
      retry: false,
      circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60_000 },
    });
    await assert.rejects(api.get("/down"), HttpError);
    await assert.rejects(api.get("/down"), HttpError);
    await assert.rejects(api.get("/echo"), (err: unknown) => {
      assert.ok(err instanceof CircuitOpenError);
      assert.equal(typeof err.retryAt, "number");
      return true;
    });
    assert.equal(hits["/v1/echo"], undefined); // nothing reached the server
    assert.equal((await api.get("/echo", { circuitBreaker: false })).status, 200);
  });
});

describe("caching", () => {
  test("serves repeated GETs from the cache; cache: false bypasses it", async () => {
    const api = createHttp({ baseUrl: base, cache: memoryCache() });
    const first = await api.get("/count");
    const second = await api.get("/count");
    const bypass = await api.get("/count", { cache: false });
    assert.equal(first.fromCache, false);
    assert.equal(second.fromCache, true);
    assert.deepEqual(second.data, { n: 1 });
    assert.equal(bypass.fromCache, false);
    assert.deepEqual(bypass.data, { n: 2 });
  });

  test("doesn't cache no-store responses", async () => {
    const api = createHttp({ baseUrl: base, cache: memoryCache() });
    await api.get("/no-store");
    const second = await api.get("/no-store");
    assert.equal(second.fromCache, false);
    assert.equal(hits["/v1/no-store"], 2);
  });

  test("uses cacheKey to separate entries", async () => {
    const api = createHttp({
      baseUrl: base,
      cache: memoryCache(),
      cacheKey: (config, url) => `${config.headers?.["x-user"]}:${url}`,
    });
    await api.get("/count", { headers: { "x-user": "a" } });
    const other = await api.get("/count", { headers: { "x-user": "b" } });
    assert.equal(other.fromCache, false);
  });

  test("evicts the least recently used entry", async () => {
    const entry = (body: string): CacheEntry => ({ status: 200, headers: [], body, storeAt: 0 });
    const cache = memoryCache(2);
    await cache.set("a", entry("1"), 10_000);
    await cache.set("b", entry("2"), 10_000);
    await cache.get("a");
    await cache.set("c", entry("3"), 10_000);
    assert.equal(await cache.get("b"), undefined);
    assert.ok(await cache.get("a"));
  });
});

describe("interceptors", () => {
  test("request interceptors change the request and can be removed", async () => {
    const api = createHttp({ baseUrl: base, cache: false });
    const remove = api.interceptors.request.use((config) => ({
      ...config,
      headers: { ...config.headers, "x-trace": "t1" },
    }));
    assert.equal((await api.get<Echo>("/echo")).data.headers["x-trace"], "t1");
    remove();
    assert.equal((await api.get<Echo>("/echo")).data.headers["x-trace"], undefined);
  });

  test("a response interceptor can recover from an error", async () => {
    const api = createHttp({ baseUrl: base, cache: false });
    api.interceptors.response.use({
      onRejected(err): HttpResponse {
        if (err instanceof HttpError && err.status === 404) {
          return {
            status: 200,
            statusText: "OK",
            headers: new Headers(),
            data: null,
            config: err.config,
            fromCache: false,
          };
        }
        throw err;
      },
    });
    assert.equal((await api.get("/missing")).data, null);
  });
});

describe("token refresh", () => {
  test("concurrent 401s share one refresh and are replayed with the new token", async () => {
    let token = "old";
    let refreshes = 0;
    const api = createHttp({
      baseUrl: base,
      cache: false,
      async refreshAuth() {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 20));
        token = "new";
      },
    });
    api.interceptors.request.use((config) => ({
      ...config,
      headers: { ...config.headers, authorization: `Bearer ${token}` },
    }));
    validToken = "new";
    const results = await Promise.all([api.get("/me"), api.get("/me"), api.get("/me")]);
    assert.equal(refreshes, 1);
    for (const res of results) assert.deepEqual(res.data, { me: true });
  });

  test("a failed refresh surfaces the original 401", async () => {
    const api = createHttp({
      baseUrl: base,
      cache: false,
      async refreshAuth() {
        throw new Error("refresh failed");
      },
    });
    await assert.rejects(
      api.get("/me"),
      (err: unknown) => err instanceof HttpError && err.status === 401,
    );
    assert.equal(hits["/v1/me"], 1);
  });
});
