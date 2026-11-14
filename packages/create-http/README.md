# fast-http-client

A small HTTP client built on `fetch`, for browsers and Node 22+. It adds what plain `fetch` leaves out:

- a base URL, default headers and query-string encoding
- JSON bodies sent and parsed automatically
- errors thrown for non-2xx responses, with the parsed body attached
- a timeout on every attempt, and cancellation with an `AbortSignal`
- retries with exponential backoff that honour `Retry-After`
- a circuit breaker per origin, so a failing service gets a rest
- caching of GET responses in memory, IndexedDB, Redis or your own store
- request and response interceptors
- a token refresh on `401`, shared by every request waiting on it

**Documentation site: [sajanv88.github.io/create-http](https://sajanv88.github.io/create-http/)**

It has no runtime dependencies.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Making requests](#making-requests)
- [Errors](#errors)
- [Timeouts and cancellation](#timeouts-and-cancellation)
- [Retries](#retries)
- [Circuit breaker](#circuit-breaker)
- [Caching](#caching)
- [Interceptors](#interceptors)
- [Refreshing an expired token](#refreshing-an-expired-token)
- [How a request flows](#how-a-request-flows)
- [API reference](#api-reference)
- [Development](#development)

## Install

```sh
npm install fast-http-client
# or: pnpm add fast-http-client / yarn add fast-http-client
```

**Requirements:** Node 22 or later, or a browser that supports `AbortSignal.any` (all current ones do). The package is ESM only and ships its own TypeScript types.

Inside this monorepo, depend on the local copy instead: `"fast-http-client": "workspace:*"`. `turbo run build` builds the package before the apps that use it, and `pnpm dev` keeps it rebuilding alongside them.

## Quick start

```ts
import { createHttp } from "fast-http-client";

export const api = createHttp({
  baseUrl: "https://api.example.com/v1",
  headers: { accept: "application/json" },
});

interface User {
  id: string;
  name: string;
}

const { data: user } = await api.get<User>("/users/42");
const { data: created } = await api.post<User>("/users", { name: "Ada" });
```

Create one client per API and share it. Retries, the circuit breaker and the cache all live on the client.

## Making requests

### Methods

```ts
api.get<T>(url, options?)
api.head<T>(url, options?)
api.delete<T>(url, options?)
api.options<T>(url, options?)
api.post<T>(url, body?, options?)
api.put<T>(url, body?, options?)
api.patch<T>(url, body?, options?)
api.request<T>({ url, method, body, ...options }) // everything in one object
```

Each one returns `Promise<HttpResponse<T>>`:

```ts
interface HttpResponse<T> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  config: RequestConfig; // the config that was actually sent
  fromCache: boolean;
}
```

> `T` is a type assertion. Nothing checks the data at runtime. If the data comes from outside your control, parse it, for example with valibot: `v.parse(UserSchema, res.data)`.

### Per-request options

| Option | Type | |
| --- | --- | --- |
| `query` | `Record<string, QueryValue \| QueryValue[]>` | Appended to the URL. Arrays repeat the key; `null` and `undefined` are skipped. |
| `headers` | `Record<string, string>` | Merged over the client's headers. Names are case-insensitive. |
| `baseUrl` | `string` | Overrides the client's base URL for this request. |
| `timeoutMs` | `number` | Overrides the client's timeout. |
| `signal` | `AbortSignal` | Cancels the request, including any retry wait. |
| `retry` | `false \| Partial<RetryOptions>` | Turns retries off, or changes them for this request. |
| `circuitBreaker` | `false` | Skips the circuit breaker. |
| `cache` | `boolean` | `false` skips the cache, both reading and writing. |
| `cacheTtlMs` | `number` | How long this response stays cached. |

```ts
await api.get("/search", {
  query: { q: "lamps", tag: ["new", "sale"], page: 2, draft: undefined },
  headers: { "x-request-id": crypto.randomUUID() },
});
// GET https://api.example.com/v1/search?q=lamps&tag=new&tag=sale&page=2
```

### URLs

A relative `url` is resolved against `baseUrl`, and the base's path is kept: with `baseUrl: "https://api.example.com/v1"`, both `"/users"` and `"users"` go to `https://api.example.com/v1/users`. An absolute URL ignores `baseUrl`.

Without a `baseUrl`, a browser resolves relative URLs against the page. In Node the URL must be absolute.

### Request bodies

| You pass | Sent as |
| --- | --- |
| a plain object, array, number or boolean | JSON, with `content-type: application/json` unless you set one |
| `string`, `Blob`, `FormData`, `URLSearchParams`, `ArrayBuffer`, a typed array, `ReadableStream` | as is; the runtime sets the content type |
| `undefined` or `null` | no body |

```ts
const form = new FormData();
form.append("avatar", file);
await api.post("/users/42/avatar", form);
```

### Response bodies

| Response | `data` is |
| --- | --- |
| `HEAD`, or status 204, 205 or 304 | `undefined` |
| `application/json` or `*+json` | the parsed value (`undefined` if empty, the raw text if it isn't valid JSON) |
| `text/*`, `*/xml`, `*+xml`, or no content type | a `string` |
| anything else | a `Blob` |

## Errors

| Thrown | When |
| --- | --- |
| `HttpError` | The server answered with a status outside 200–299. Has `status`, `statusText`, `data` (the parsed body), `headers` and `config`. |
| `CircuitOpenError` | The circuit for that origin is open, so no request was sent. Has `circuit` (the origin) and `retryAt` (epoch ms) when known. |
| `DOMException` named `TimeoutError` | An attempt ran past `timeoutMs`, and retries didn't help. |
| `DOMException` named `AbortError` | Your `signal` was aborted. |
| `TypeError` | A network failure: DNS, refused connection, CORS. |

```ts
import { CircuitOpenError, HttpError } from "fast-http-client";

try {
  await api.get("/orders/7");
} catch (err) {
  if (err instanceof HttpError && err.status === 404) return null;
  if (err instanceof CircuitOpenError) {
    showBanner(`Service unavailable, retry after ${new Date(err.retryAt ?? Date.now())}`);
    return null;
  }
  throw err;
}
```

## Timeouts and cancellation

Every attempt gets its own timeout, 10 seconds by default. Set it on the client or per request:

```ts
const api = createHttp({ baseUrl, timeoutMs: 5_000 });
await api.get("/reports/big", { timeoutMs: 60_000 });
```

With retries, a request can take longer than `timeoutMs` in total: each attempt has the full timeout, plus the wait between attempts.

Pass a `signal` to cancel. It stops the attempt in flight and any wait before a retry, and a cancelled request is never retried:

```ts
const controller = new AbortController();
const promise = api.get("/search", { query: { q }, signal: controller.signal });
controller.abort(); // promise rejects with an AbortError
```

## Retries

Retries are on by default:

| Option | Default | |
| --- | --- | --- |
| `attempts` | `3` | Total tries, including the first. |
| `baseDelayMs` | `200` | Base for the backoff. |
| `maxDelayMs` | `5000` | Cap on any single wait, including `Retry-After`. |
| `methods` | `GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS` | Only idempotent methods; `POST` and `PATCH` aren't retried. |
| `statusCodes` | `408`, `425`, `429`, `500`, `502`, `503`, `504` | Statuses that are worth another try. |

A request is retried when it failed with one of those statuses, a network error or a timeout. It is not retried after a cancel, when the circuit is open, or when the body is a `ReadableStream`, which can only be sent once.

**Delay:** if the response has a `Retry-After` header (seconds or an HTTP date), it's used, capped at `maxDelayMs`. Otherwise the wait before attempt *n + 1* is a random time between 0 and `min(maxDelayMs, baseDelayMs × 2^(n−1))`. The randomness ("full jitter") stops many clients from retrying in sync.

```ts
// Client-wide
const api = createHttp({ baseUrl, retry: { attempts: 5, maxDelayMs: 10_000 } });
const noRetries = createHttp({ baseUrl, retry: false });

// Per request
await api.get("/health", { retry: false });
await api.post("/payments", body, { retry: { methods: ["POST"], statusCodes: [503] } }); // only if the endpoint is idempotent
```

Per-request fields are merged over the client's, which are merged over `DEFAULT_RETRY`.

## Circuit breaker

The client keeps one circuit per origin (`https://api.example.com`), so one slow service doesn't block calls to another.

- **Closed:** requests go through. Consecutive failures are counted, and any success resets the count.
- **Open:** after `failureThreshold` consecutive failures, requests fail at once with `CircuitOpenError` for `resetTimeoutMs`, without touching the network.
- **Half-open:** after that, one trial request goes through, and others still fail fast. If it succeeds the circuit closes; if it fails, it opens again.

Every retry attempt passes through the breaker, so retries stop as soon as the circuit opens.

| Option | Default | |
| --- | --- | --- |
| `failureThreshold` | `5` | Consecutive failures before opening. |
| `resetTimeoutMs` | `30000` | How long the circuit stays open before a trial. |
| `isFailure` | 5xx, network errors and timeouts | Which errors count. A 4xx counts as a success: the server is answering. |
| `onStateChange` | none | `(circuit, from, to) => void`, for logging and metrics. |

```ts
const api = createHttp({
  baseUrl,
  circuitBreaker: {
    failureThreshold: 3,
    onStateChange: (circuit, from, to) => console.warn(`circuit ${circuit}: ${from} → ${to}`),
  },
});

await api.get("/status", { circuitBreaker: false }); // bypass it for one request
const noBreaker = createHttp({ baseUrl, circuitBreaker: false });
```

A cancelled request doesn't count either way.

## Caching

The client can cache `GET` responses. A response is stored only if:

- the status is 200,
- it has no `Cache-Control: no-store`, and
- its body is JSON or text (`Blob` bodies are never cached).

A cached response skips the network, the retries and the breaker, but still runs your response interceptors. It comes back with `fromCache: true`.

Entries live for `cacheTtlMs` (60 seconds by default). The client doesn't read `Cache-Control: max-age` or `ETag`; the TTL is the only rule.

### Choosing a store

| `cache` | Store |
| --- | --- |
| not set | IndexedDB in browsers, off in Node |
| `false` | off |
| `"memory"` | in-process, least-recently-used, 500 entries |
| `"indexeddb"` | IndexedDB; throws when the runtime has none |
| an adapter | your own, for example `memoryCache(…)` or `redisCache(…)` |

```ts
import { createHttp, memoryCache, redisCache } from "fast-http-client";
import Redis from "ioredis";

// Browser: persists across reloads
const browserApi = createHttp({ baseUrl, cache: "indexeddb", cacheTtlMs: 5 * 60_000 });

// Node, one process
const localApi = createHttp({ baseUrl, cache: memoryCache(1_000) });

// Node, shared between processes (any client with ioredis's get / set(key, value, "PX", ms) / del)
const sharedApi = createHttp({ baseUrl, cache: redisCache(new Redis(process.env.REDIS_URL), "api:") });
```

A cache that fails, for example because IndexedDB is blocked or Redis is down, never fails the request. The client falls back to the network.

### Per request

```ts
await api.get("/prices", { cache: false });            // neither read nor write the cache
await api.get("/countries", { cacheTtlMs: 86_400_000 }); // keep for a day
```

### Cache keys and signed-in users

By default the key is the full URL. That is fine for public data and for a cache only one user can see, like IndexedDB in their browser.

**A shared cache (Redis, or `memoryCache` on a server) must not use the URL alone when responses depend on who is asking.** Otherwise one user's response is served to another. Put the user in the key:

```ts
const api = createHttp({
  baseUrl,
  cache: redisCache(redis),
  cacheKey: (config, url) => `${config.headers?.["x-user-id"] ?? "anon"}:${url}`,
});
```

Or turn caching off for those requests with `cache: false`.

### Your own store

Implement `CacheAdapter`:

```ts
import type { CacheAdapter } from "fast-http-client";

const myCache: CacheAdapter = {
  async get(key) { /* return a CacheEntry, or undefined if missing or expired */ },
  async set(key, entry, ttlMs) { /* store it; expire it after ttlMs */ },
  async delete(key) { /* remove it */ },
};
```

The adapter is responsible for expiry: `get` must not return an entry older than its `ttlMs`.

## Interceptors

### Request interceptors

They run in the order you add them, each receiving the config the previous one returned. They may be async. They run after the client's defaults are applied, so they see the final headers and base URL.

```ts
const stop = api.interceptors.request.use(async (config) => ({
  ...config,
  headers: { ...config.headers, authorization: `Bearer ${await getToken()}` },
}));

stop(); // removes it
```

Return a new object rather than changing `config`. If an interceptor throws, nothing is sent and the error goes to the response interceptors' `onRejected`.

### Response interceptors

Each one has an optional `onFulfilled` and an optional `onRejected`. They run in the order you add them, like a chain of `.then(onFulfilled, onRejected)`:

- `onFulfilled` may change the response or throw to turn it into an error.
- `onRejected` may return a response to recover, or throw (rethrow) to pass the error on.

```ts
// Log failures and pass them on
api.interceptors.response.use({
  onRejected(error) {
    if (error instanceof HttpError) console.error(`${error.config.method ?? "GET"} ${error.config.url} → ${error.status}`);
    throw error;
  },
});

// Treat a missing profile as empty instead of an error
api.interceptors.response.use({
  onRejected(error) {
    if (error instanceof HttpError && error.status === 404 && error.config.url.startsWith("/profiles/")) {
      return { status: 200, statusText: "OK", headers: new Headers(), data: null, config: error.config, fromCache: false };
    }
    throw error;
  },
});
```

## Refreshing an expired token

Give the client a `refreshAuth` function. When a request fails with `401`:

1. `refreshAuth` is called. If several requests hit `401` at the same time, they all wait for the same single call.
2. Each request is then sent once more, through the request interceptors again, so an interceptor that adds the token attaches the new one.
3. A request is replayed only once. If the replay also returns `401`, that error is thrown. If `refreshAuth` throws, the caller gets the original `401` `HttpError`, not the refresh error.

```ts
let accessToken = "";

const api = createHttp({
  baseUrl,
  async refreshAuth() {
    // Use plain fetch (or a separate client) here, not `api`; see below
    const res = await fetch(`${baseUrl}/auth/refresh`, { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("session expired");
    accessToken = (await res.json()).accessToken;
  },
});

api.interceptors.request.use((config) => ({
  ...config,
  headers: { ...config.headers, authorization: `Bearer ${accessToken}` },
}));
```

> **Don't call the refresh endpoint through the same client.** If that call returns `401`, it waits for the refresh it is part of, and never finishes.

Request interceptors can tell a replay from a first try by `config.retried === true`. Requests with a `ReadableStream` body aren't replayed.

The refresh runs after the response interceptors. If one of them recovers from the `401`, no refresh happens.

## How a request flows

```
api.get(url, options)
  │  client defaults merged in (baseUrl, headers, timeoutMs)
  ▼
request interceptors ──────── in order
  ▼
cache lookup ──────────────── GET only; a hit skips straight to the response interceptors
  ▼
┌ retry loop ───────────────────────────────────────────────┐
│ circuit breaker (per origin) → fetch, with timeout+signal │
│ retryable failure → wait (backoff or Retry-After) → again │
└───────────────────────────────────────────────────────────┘
  ▼
cache store ───────────────── 200, not no-store, JSON or text
  ▼
response interceptors ─────── in order; can transform or recover
  ▼
401? → refreshAuth (shared) → the whole flow once more
  ▼
HttpResponse<T>  or  thrown error
```

## API reference

### `createHttp(options?: ClientOptions): HttpClient`

| Option | Type | Default |
| --- | --- | --- |
| `baseUrl` | `string` | none |
| `headers` | `Record<string, string>` | none |
| `timeoutMs` | `number` | `10000` per attempt |
| `retry` | `false \| Partial<RetryOptions>` | `DEFAULT_RETRY` |
| `circuitBreaker` | `false \| Partial<BreakerOptions>` | `DEFAULT_BREAKER` |
| `cache` | `false \| "memory" \| "indexeddb" \| CacheAdapter` | IndexedDB in browsers, off in Node |
| `cacheTtlMs` | `number` | `60000` |
| `cacheKey` | `(config: RequestConfig, url: string) => string` | the full URL |
| `refreshAuth` | `() => Promise<void>` | none (a `401` is just an error) |

### Exports

| Export | Kind |
| --- | --- |
| `createHttp` | function |
| `memoryCache(maxEntries = 500)` | cache adapter, least-recently-used |
| `indexedDbCache(dbName = "fast-http-client-cache")` | cache adapter |
| `redisCache(client, prefix = "http:")` | cache adapter |
| `HttpError`, `CircuitOpenError` | error classes |
| `DEFAULT_RETRY`, `DEFAULT_BREAKER` | default options, to read or spread |
| `ClientOptions`, `HttpClient`, `RequestOptions`, `RequestConfig`, `HttpResponse`, `HttpMethod`, `QueryValue` | types |
| `RequestInterceptor`, `ResponseInterceptor` | types |
| `RetryOptions`, `BreakerOptions`, `CircuitState` | types |
| `CacheAdapter`, `CacheEntry`, `CacheOptions`, `RedisLike` | types |

## Development

```sh
pnpm exec turbo run build --filter=fast-http-client        # compile src/ to dist/
pnpm exec turbo run test --filter=fast-http-client         # build, then run the tests
pnpm exec turbo run check-types --filter=fast-http-client  # type-check without emitting
pnpm exec turbo run dev --filter=fast-http-client          # rebuild on change
pnpm lint                                             # Biome, from the repo root
```

Source is in `src/` as `.mts` files, and `tsc` writes ES modules and type declarations to `dist/`. Tests in `test/` use `node:test` against a local HTTP server and import the built package, as a consumer would.

### Releasing

Publishing is automatic: a merge to `main` that changes `src/` publishes the version in `package.json` to npm.

1. In your PR, bump `version` in `packages/create-http/package.json`: patch for fixes, minor for new features, major for breaking changes. The PR's **version** check fails if `src/` changed and that version is already on npm or isn't higher than the latest.
2. Merge. The **Publish** workflow (`.github/workflows/main.yaml`) tests, builds and publishes the package with an npm provenance attestation, then creates the `vX.Y.Z` tag and GitHub Release.

Changes outside `src/` (README, tests, tooling) don't publish and don't need a bump. To publish one of those anyway, bump the version, merge, and run **Publish** by hand from the Actions tab.

## License

[MIT](./LICENSE)
