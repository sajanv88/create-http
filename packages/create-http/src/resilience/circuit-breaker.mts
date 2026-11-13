import { CircuitOpenError } from "../errors.mjs";

export type CircuitState = "closed" | "open" | "half-open";

export interface BreakerOptions {
  failureThreshold: number; // consecutive failures before opening
  resetTimeoutMs: number; // time open before a trial request
  isFailure: (err: unknown) => boolean; // which errors count against the circuit
  onStateChange?: (circuit: string, from: CircuitState, to: CircuitState) => void;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;
  private trialInFlight = false;

  constructor(
    private readonly name: string,
    private readonly opts: BreakerOptions,
  ) {}

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.beforeCall();
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      if (isAbortError(err))
        this.trialInFlight = false; // a cancel says nothing about server health
      else if (this.opts.isFailure(err)) this.onFailure();
      else this.onSuccess(); // e.g. a 404: the server answered
      throw err;
    }
  }

  private beforeCall(): void {
    if (this.state === "open") {
      const retryAt = this.openedAt + this.opts.resetTimeoutMs;
      if (Date.now() < retryAt) throw new CircuitOpenError(this.name, retryAt);
      this.transition("half-open");
    }
    if (this.state === "half-open") {
      if (this.trialInFlight) throw new CircuitOpenError(this.name); // only one trial at a time
      this.trialInFlight = true;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    this.trialInFlight = false;
    this.transition("closed");
  }

  private onFailure(): void {
    this.trialInFlight = false;
    this.failures += 1;
    if (this.state === "half-open" || this.failures >= this.opts.failureThreshold) {
      this.openedAt = Date.now();
      this.failures = 0;
      this.transition("open");
    }
  }

  private transition(to: CircuitState): void {
    if (this.state === to) return;
    const from = this.state;
    this.state = to;
    this.opts.onStateChange?.(this.name, from, to);
  }
}

function isAbortError(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}
