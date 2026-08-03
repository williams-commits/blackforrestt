/**
 * Small process-local keyed mutex.
 *
 * The current trading engine is intentionally single-process because open
 * positions live in memory. This lock serializes money/position mutations per
 * user so concurrent HTTP requests and market-triggered closes cannot spend or
 * release the same funds twice. A distributed lock or database-native order
 * service is required before running multiple application replicas.
 */
export class KeyedMutex {
  private tails = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, work: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => current);
    this.tails.set(key, tail);

    await previous.catch(() => undefined);
    try {
      return await work();
    } finally {
      release();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}

export const userMutationMutex = new KeyedMutex();
