import { type BreakerOptions, CircuitBreaker } from "./circuit-breaker.mjs";

export class BreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  constructor(private readonly opts: BreakerOptions) {}

  forUrl(absoluteUrl: string): CircuitBreaker {
    const circuit = new URL(absoluteUrl).origin; // one circuit per host
    let breaker = this.breakers.get(circuit);
    if (!breaker) {
      breaker = new CircuitBreaker(circuit, this.opts);
      this.breakers.set(circuit, breaker);
    }
    return breaker;
  }
}
