import { resolve } from "@std/path";
import type { ReloadSource } from "./reload-source.ts";

type WatchedReloadSource = ReloadSource & { close(): void };
type ReloadSubscriber = {
  notify: () => void | Promise<void>;
  close?: () => void;
};

export function createReloadWatcher(
  root: string,
  signal?: AbortSignal,
): WatchedReloadSource {
  return new ReloadHub(Deno.watchFs(resolve(root)), signal);
}

class ReloadHub implements WatchedReloadSource {
  #closed = false;
  #subscribers = new Set<ReloadSubscriber>();
  #timer?: ReturnType<typeof setTimeout>;
  #notifications = Promise.resolve();
  readonly #watcher: Deno.FsWatcher;
  readonly #signal?: AbortSignal;

  constructor(
    watcher: Deno.FsWatcher,
    signal?: AbortSignal,
  ) {
    this.#watcher = watcher;
    this.#signal = signal;
    if (this.#signal?.aborted) {
      this.close();
      return;
    }
    this.#signal?.addEventListener("abort", this.close, { once: true });
    void this.watch();
  }

  subscribe(
    notify: () => void | Promise<void>,
    onClose?: () => void,
  ): () => void {
    if (this.#closed) {
      onClose?.();
      return () => {};
    }

    const subscriber = { notify, close: onClose };
    this.#subscribers.add(subscriber);
    return () => this.#subscribers.delete(subscriber);
  }

  close = (): void => {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#signal?.removeEventListener("abort", this.close);
    this.#watcher.close();
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
    const subscribers = this.#subscribers;
    this.#subscribers = new Set();
    for (const subscriber of subscribers) {
      try {
        subscriber.close?.();
      } catch {
        // One disconnected client must not retain the remaining clients.
      }
    }
  };

  async watch(): Promise<void> {
    try {
      for await (const _event of this.#watcher) {
        this.scheduleReload();
      }
    } catch {
      // Closing the watcher also ends iteration; subscribers must still close.
    } finally {
      this.close();
    }
  }

  scheduleReload(): void {
    if (this.#closed) {
      return;
    }
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
    }
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      if (!this.#closed) {
        this.#notifications = this.#notifications.then(() => this.notify());
      }
    }, 50);
  }

  async notify(): Promise<void> {
    for (const subscriber of this.#subscribers) {
      if (this.#closed) {
        return;
      }
      try {
        await subscriber.notify();
      } catch {
        // One disconnected client must not block remaining notifications.
      }
    }
  }
}
