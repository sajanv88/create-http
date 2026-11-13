import type { RequestConfig } from "./types.mjs";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly data: unknown,
    public readonly config: RequestConfig,
    public readonly headers: Headers,
  ) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "HttpError";
  }
}

export class CircuitOpenError extends Error {
  constructor(
    public readonly circuit: string,
    public readonly retryAt?: number,
  ) {
    super(`Circuit open for ${circuit}`);
    this.name = "CircuitOpenError";
  }
}
