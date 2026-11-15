import { resolveCache } from "./cache/resolve.mjs";
import type { CacheEntry, CacheOptions } from "./cache/types.mjs";
import { HttpError } from "./errors.mjs";
import { runPipeline } from "./pipeline.mjs";
import { BreakerRegistry } from "./resilience/breaker-registry.mjs";
import type { BreakerOptions } from "./resilience/circuit-breaker.mjs";
import { DEFAULT_RETRY, type RetryOptions } from "./resilience/retry.mjs";
import { attemptOnce, sendWithResilience } from "./transport.mjs";
import type {
  HttpResponse,
  RequestConfig,
  RequestInterceptor,
  ResponseInterceptor,
} from "./types.mjs";
import { buildUrl } from "./url.mjs";

export interface ClientOptions {
  /** Every relative `url` is resolved against this. A path such as `/v1` is kept. */
  baseUrl?: string;
  /** Sent with every request; per-request headers win. */
  headers?: Record<string, string>;
  /** Per attempt, in ms. Default 10 000. */
  timeoutMs?: number;
  /** `false` turns retries off; an object overrides fields of `DEFAULT_RETRY`. */
  retry?: false | Partial<RetryOptions>;
  /** `false` turns the per-origin circuit breaker off; an object overrides `DEFAULT_BREAKER`. */
  circuitBreaker?: false | Partial<BreakerOptions>;
  /** Where GET responses are cached. Default: off. */
  cache?: CacheOptions;
  /** How long a cached response stays fresh, in ms. Default 60 000. */
  cacheTtlMs?: number;
  /**
   * Cache key for a request. Default: the full URL. Requests with an `Authorization` header
   * are only cached when this is set, so the key can say whose response it is.
   */
  cacheKey?: (config: RequestConfig, url: string) => string;
  /** Called once on a 401; the request is then sent again a single time. */
  refreshAuth?: () => Promise<void>;
}

/** Per-request options for the method shortcuts. */
export type RequestOptions = Omit<RequestConfig, "url" | "method" | "body" | "retried">;

export interface HttpClient {
  request<T = unknown>(config: RequestConfig): Promise<HttpResponse<T>>;
  get<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  head<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  delete<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  options<T = unknown>(url: string, options?: RequestOptions): Promise<HttpResponse<T>>;
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;
  put<T = unknown>(url: string, body?: unknown, options?: RequestOptions): Promise<HttpResponse<T>>;
  patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>>;
  interceptors: {
    /** Returns a function that removes the interceptor. */
    request: { use(fn: RequestInterceptor): () => void };
    /** Returns a function that removes the interceptor. */
    response: { use(handlers: ResponseInterceptor): () => void };
  };
  /** The client's response cache. Both calls do nothing when caching is off. */
  cache: {
    /** Removes every cached response. Call it when the user logs out. */
    clear(): Promise<void>;
    /**
     * Removes the cached GET for this URL. Request interceptors run first, so a `cacheKey`
     * that reads a header they add finds the same entry.
     */
    delete(url: string, options?: RequestOptions): Promise<void>;
  };
}

export const DEFAULT_BREAKER: BreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,
  // Server errors, network failures and timeouts count; 4xx means the server is up and answering.
  isFailure: (err) =>
    err instanceof HttpError
      ? err.status >= 500
      : err instanceof TypeError || (err as Error)?.name === "TimeoutError",
};

const DEFAULT_CACHE_TTL_MS = 60_000;
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function createHttp(options: ClientOptions = {}): HttpClient {
  const requestInterceptors: RequestInterceptor[] = [];
  const responseInterceptors: ResponseInterceptor[] = [];
  const cache = resolveCache(options.cache);
  const breakers =
    options.circuitBreaker === false
      ? undefined
      : new BreakerRegistry({ ...DEFAULT_BREAKER, ...options.circuitBreaker });
  let refreshing: Promise<void> | undefined;

  function withDefaults(config: RequestConfig): RequestConfig {
    const merged: RequestConfig = {
      ...config,
      headers: mergeHeaders(options.headers, config.headers),
    };
    const baseUrl = config.baseUrl ?? options.baseUrl;
    if (baseUrl !== undefined) merged.baseUrl = baseUrl;
    const timeoutMs = config.timeoutMs ?? options.timeoutMs;
    if (timeoutMs !== undefined) merged.timeoutMs = timeoutMs;
    return merged;
  }

  function retryFor(config: RequestConfig): RetryOptions | false {
    if (config.body instanceof ReadableStream) return false; // a stream can only be sent once
    if (config.retry === false) return false;
    if (config.retry === undefined && options.retry === false) return false;
    return { ...DEFAULT_RETRY, ...(options.retry || {}), ...config.retry };
  }

  // The key a GET to this request's URL is stored under. Called after the request
  // interceptors, so it sees the final URL and headers.
  function keyFor(config: RequestConfig, url: string): string {
    return options.cacheKey?.({ ...config, method: "GET" }, url) ?? url;
  }

  // A request with credentials gets a response meant for one user. Keyed by URL alone it
  // would be served to whoever asks next, so it's only cached under a cacheKey.
  function cacheable(config: RequestConfig): boolean {
    if (options.cacheKey) return true;
    return !Object.keys(config.headers ?? {}).some(
      (name) => name.toLowerCase() === "authorization",
    );
  }

  async function send(config: RequestConfig): Promise<HttpResponse> {
    const url = buildUrl(config.baseUrl, config.url, config.query);
    const method = config.method ?? "GET";
    const key =
      cache && method === "GET" && config.cache !== false && cacheable(config)
        ? keyFor(config, url)
        : undefined;

    if (cache && key !== undefined) {
      const hit = await cache.get(key).catch(() => undefined); // a broken cache never fails a request
      if (hit) return fromEntry(hit, config);
    }

    const breaker = breakers && config.circuitBreaker !== false ? breakers.forUrl(url) : undefined;
    const res = await sendWithResilience(config, attemptOnce, breaker, retryFor(config));

    // A write that succeeded makes the cached GET for its URL stale (RFC 9111, section 4.4).
    // Awaited, so a GET sent right after the write can't read the old entry.
    if (cache && !SAFE_METHODS.has(method)) {
      await cache.delete(keyFor(config, url)).catch(() => {});
    }

    if (cache && key !== undefined) {
      const entry = toEntry(res);
      if (entry) {
        const ttl = config.cacheTtlMs ?? options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
        cache.set(key, entry, ttl).catch(() => {});
      }
    }
    return res;
  }

  function refreshOnce(refresh: () => Promise<void>): Promise<void> {
    // Concurrent 401s share one refresh.
    refreshing ??= refresh().finally(() => {
      refreshing = undefined;
    });
    return refreshing;
  }

  async function request<T>(config: RequestConfig): Promise<HttpResponse<T>> {
    const cfg = withDefaults(config);
    const run = (c: RequestConfig) =>
      runPipeline(c, [...requestInterceptors], [...responseInterceptors], send) as Promise<
        HttpResponse<T>
      >;
    try {
      return await run(cfg);
    } catch (err) {
      const refresh = options.refreshAuth;
      const canReplay = !cfg.retried && !(cfg.body instanceof ReadableStream);
      if (!refresh || !canReplay || !(err instanceof HttpError) || err.status !== 401) throw err;
      try {
        await refreshOnce(refresh);
      } catch {
        throw err; // a failed refresh surfaces as the original 401
      }
      return run({ ...cfg, retried: true }); // request interceptors run again and see the new token
    }
  }

  const withoutBody =
    (method: "GET" | "HEAD" | "DELETE" | "OPTIONS") =>
    <T,>(url: string, opts?: RequestOptions) =>
      request<T>({ ...opts, url, method });
  const withBody =
    (method: "POST" | "PUT" | "PATCH") =>
    <T,>(url: string, body?: unknown, opts?: RequestOptions) =>
      request<T>({ ...opts, url, method, body });

  return {
    request,
    get: withoutBody("GET"),
    head: withoutBody("HEAD"),
    delete: withoutBody("DELETE"),
    options: withoutBody("OPTIONS"),
    post: withBody("POST"),
    put: withBody("PUT"),
    patch: withBody("PATCH"),
    interceptors: {
      request: { use: (fn) => addTo(requestInterceptors, fn) },
      response: { use: (handlers) => addTo(responseInterceptors, handlers) },
    },
    cache: {
      async clear() {
        await cache?.clear();
      },
      async delete(url, opts) {
        if (!cache) return;
        let cfg = withDefaults({ ...opts, url, method: "GET" });
        for (const fn of [...requestInterceptors]) cfg = await fn(cfg);
        await cache.delete(keyFor(cfg, buildUrl(cfg.baseUrl, cfg.url, cfg.query)));
      },
    },
  };
}

function addTo<T>(list: T[], item: T): () => void {
  list.push(item);
  return () => {
    const i = list.indexOf(item);
    if (i !== -1) list.splice(i, 1);
  };
}

function mergeHeaders(...sources: (Record<string, string> | undefined)[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const source of sources) {
    for (const [name, value] of Object.entries(source ?? {})) out[name.toLowerCase()] = value;
  }
  return out;
}

function toEntry(res: HttpResponse): CacheEntry | undefined {
  if (res.status !== 200) return undefined;
  if (/\bno-store\b/i.test(res.headers.get("cache-control") ?? "")) return undefined;
  if (res.data === undefined || res.data instanceof Blob) return undefined; // only JSON and text
  return {
    status: res.status,
    headers: [...res.headers],
    body: JSON.stringify(res.data),
    storeAt: Date.now(),
  };
}

function fromEntry(entry: CacheEntry, config: RequestConfig): HttpResponse {
  return {
    status: entry.status,
    statusText: "OK", // only 200s are cached
    headers: new Headers(entry.headers),
    data: JSON.parse(entry.body),
    config,
    fromCache: true,
  };
}
