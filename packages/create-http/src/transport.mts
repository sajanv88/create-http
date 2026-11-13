import { encodeBody } from "./encode.mjs";
import { HttpError } from "./errors.mjs";
import type { CircuitBreaker } from "./resilience/circuit-breaker.mjs";
import type { RetryOptions } from "./resilience/retry.mjs";
import { retryDelay, shouldRetry, sleep } from "./resilience/retry.mjs";
import type { HttpResponse, RequestConfig } from "./types.mjs";
import { buildUrl } from "./url.mjs";

export async function sendWithResilience(
  config: RequestConfig,
  attempt: (config: RequestConfig) => Promise<HttpResponse>,
  breaker: CircuitBreaker | undefined, // undefined when the request opts out with circuitBreaker: false
  retry: RetryOptions | false,
): Promise<HttpResponse> {
  const once = () => (breaker ? breaker.exec(() => attempt(config)) : attempt(config));
  for (let n = 1; ; n++) {
    try {
      return await once(); // every attempt passes the breaker
    } catch (err) {
      if (!retry || !shouldRetry(err, config, n, retry)) throw err;
      await sleep(retryDelay(n, err, retry), config.signal);
    }
  }
}

export async function attemptOnce(config: RequestConfig): Promise<HttpResponse> {
  const signals = [AbortSignal.timeout(config.timeoutMs ?? 10_000)]; // fresh timeout per attempt
  if (config.signal) signals.push(config.signal);

  const headers = new Headers(config.headers);
  const body = encodeBody(config.body, headers);
  const init: RequestInit & { duplex?: "half" } = {
    method: config.method ?? "GET",
    headers,
    signal: AbortSignal.any(signals), // Node 20.3+ and modern browsers
  };
  if (body !== undefined) init.body = body;
  if (body instanceof ReadableStream) init.duplex = "half"; // required by Node's fetch for stream bodies

  const res = await fetch(buildUrl(config.baseUrl, config.url, config.query), init);

  const data = await parseBody(res, init.method);
  if (!res.ok) throw new HttpError(res.status, res.statusText, data, config, res.headers);
  return {
    data,
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    config,
    fromCache: false,
  };
}

async function parseBody(res: Response, method: string | undefined): Promise<unknown> {
  if (method === "HEAD" || res.status === 204 || res.status === 205 || res.status === 304) {
    return undefined;
  }
  const type = res.headers.get("content-type") ?? "";
  if (/[/+]json\b/.test(type)) {
    const text = await res.text();
    if (!text) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return text; // mislabelled body (often an error page): keep it rather than lose the HttpError
    }
  }
  if (type === "" || type.startsWith("text/") || /[/+]xml\b/.test(type)) return res.text();
  return res.blob();
}
