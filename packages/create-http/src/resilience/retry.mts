import { CircuitOpenError, HttpError } from "../errors.mjs";
import type { RequestConfig } from "../types.mjs";

export interface RetryOptions {
  attempts: number; // total tries, including the first
  baseDelayMs: number;
  maxDelayMs: number;
  methods: string[]; // idempotent methods only, by default
  statusCodes: number[];
}

export const DEFAULT_RETRY: RetryOptions = {
  attempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 5_000,
  methods: ["GET", "HEAD", "PUT", "DELETE", "OPTIONS"],
  statusCodes: [408, 425, 429, 500, 502, 503, 504],
};

export function shouldRetry(
  err: unknown,
  config: RequestConfig,
  attempt: number,
  opts: RetryOptions,
): boolean {
  if (attempt >= opts.attempts) return false;
  if (config.signal?.aborted) return false; // the caller cancelled
  if (err instanceof CircuitOpenError) return false; // never retry a fail-fast
  if (!opts.methods.includes(config.method ?? "GET")) return false; // POST is not retried by default
  if (err instanceof HttpError) return opts.statusCodes.includes(err.status);
  // fetch network failures are TypeError; our per-attempt timeout is TimeoutError
  return err instanceof TypeError || (err as Error)?.name === "TimeoutError";
}

export function retryDelay(attempt: number, err: unknown, opts: RetryOptions): number {
  // Honour the server's Retry-After first, capped at maxDelayMs
  const retryAfter =
    err instanceof HttpError ? parseRetryAfter(err.headers.get("retry-after")) : undefined;
  if (retryAfter !== undefined) return Math.min(retryAfter, opts.maxDelayMs);

  // Exponential backoff with full jitter, so clients don't retry in sync
  const ceiling = Math.min(opts.maxDelayMs, opts.baseDelayMs * 2 ** (attempt - 1));
  return Math.random() * ceiling;
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) return seconds * 1000; // "120"
  const date = Date.parse(value); // "Wed, 21 Oct 2026 07:28:00 GMT"
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason); // already cancelled: don't wait at all
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason); // a cancel stops the wait immediately
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort); // don't pile listeners on a long-lived signal
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
