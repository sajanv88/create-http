import type { RetryOptions } from "./resilience/retry.mjs";

export type HttpMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestConfig {
  baseUrl?: string; // usually the client default; `url` is resolved against it
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue | QueryValue[]>;
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  cache?: boolean; // false bypasses the cache for this request
  cacheTtlMs?: number; // overrides the client default
  retry?: false | Partial<RetryOptions>; // per-request override
  circuitBreaker?: false; // skip the breaker for this request
  retried?: boolean; // internal guard for the 401 refresh retry
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  config: RequestConfig;
  fromCache: boolean;
}

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

export interface ResponseInterceptor {
  onFulfilled?: (res: HttpResponse) => HttpResponse | Promise<HttpResponse>;
  onRejected?: (error: unknown) => HttpResponse | Promise<HttpResponse>; // return to recover, throw to pass on
}
