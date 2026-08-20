export class AsyncLimiter {
  readonly #limit: number;
  #pending: Array<() => void> = [];
  #running = 0;

  constructor(limit: number) {
    this.#limit = limit;
  }

  run<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.#running++;
        Promise.resolve().then(operation).then(resolve, reject).finally(() => {
          this.#running--;
          this.#pending.shift()?.();
        });
      };
      if (this.#running < this.#limit) {
        run();
      } else {
        this.#pending.push(run);
      }
    });
  }
}
