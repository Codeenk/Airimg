export interface BreakerState {
  state: 'closed' | 'open';
  trippedAt: number;
  failureCount: number;
}

const BREAKER_KV_KEY = 'breaker:public-hotlink';
const FAILURE_THRESHOLD = 5;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class CircuitBreaker {
  private kv: KVNamespace;
  private localFailureCount = 0;
  private lastKvWrite = 0;

  constructor(kv: KVNamespace) {
    this.kv = kv;
  }

  async getState(): Promise<'closed' | 'open'> {
    const raw = await this.kv.get(BREAKER_KV_KEY);
    if (!raw) return 'closed';

    try {
      const state: BreakerState = JSON.parse(raw);
      if (state.state === 'open') {
        // Check if cooldown period has passed
        if (Date.now() - state.trippedAt > COOLDOWN_MS) {
          // Cooldown expired — transition to half-open (treat as closed for probing)
          return 'closed';
        }
        return 'open';
      }
      return 'closed';
    } catch {
      return 'closed';
    }
  }

  async recordFailure(): Promise<void> {
    this.localFailureCount++;

    // Only write to KV on state transition (debounce)
    if (this.localFailureCount >= FAILURE_THRESHOLD) {
      const currentState = await this.getState();
      if (currentState === 'closed') {
        // Trip the breaker — single KV write
        const newState: BreakerState = {
          state: 'open',
          trippedAt: Date.now(),
          failureCount: this.localFailureCount,
        };
        await this.kv.put(BREAKER_KV_KEY, JSON.stringify(newState));
        this.lastKvWrite = Date.now();
      }
    }
  }

  async recordSuccess(): Promise<void> {
    const raw = await this.kv.get(BREAKER_KV_KEY);
    if (!raw) return; // Already closed, no write needed

    try {
      const state: BreakerState = JSON.parse(raw);
      if (state.state === 'open' && Date.now() - state.trippedAt > COOLDOWN_MS) {
        // Cooldown passed + success → close the breaker (single KV write)
        await this.kv.delete(BREAKER_KV_KEY);
        this.localFailureCount = 0;
      }
    } catch {
      // Corrupted state — reset
      await this.kv.delete(BREAKER_KV_KEY);
    }
  }

  // Exposed for testing
  getLocalFailureCount(): number {
    return this.localFailureCount;
  }
}

export { BREAKER_KV_KEY, FAILURE_THRESHOLD, COOLDOWN_MS };
