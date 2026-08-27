import { isAbsolute, relative, resolve } from "@std/path";
import type { ReloadSource } from "./reload-source.ts";

type WatchedReloadSource = ReloadSource & { close(): void };
type ReloadSubscriber = {
  notify: () => void | Promise<void>;
  close?: () => void;
};

export function createReloadWatcher(
  root: string,
  signal?: AbortSignal,
  ignorePaths: string[] = [],
): WatchedReloadSource {
  return new ReloadHub(Deno.watchFs(resolve(root)), signal, ignorePaths);
}

export class ReloadHub implements WatchedReloadSource {
  #closed = false;
  #subscribers = new Set<ReloadSubscriber>();
  #timer?: ReturnType<typeof setTimeout>;
  #notifications = Promise.resolve();
  readonly #watcher: Deno.FsWatcher;
  readonly #signal?: AbortSignal;
  readonly #ignorePaths: string[];

  constructor(
    watcher: Deno.FsWatcher,
    signal?: AbortSignal,
    ignorePaths: string[] = [],
  ) {
    this.#watcher = watcher;
    this.#signal = signal;
    this.#ignorePaths = ignorePaths.map((path) => resolve(path));
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
      for await (const event of this.#watcher) {
        if (reloadEventRelevant(event, this.#ignorePaths)) {
          this.scheduleReload();
        } else {
          this.cancelScheduledReload();
        }
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

  cancelScheduledReload(): void {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer);
      this.#timer = undefined;
    }
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

export function reloadEventRelevant(
  event: Deno.FsEvent,
  ignorePaths: string[],
): boolean {
  return event.paths.length > 0 &&
    event.paths.every((path) =>
      !ignorePaths.some((ignored) => pathWithin(path, ignored))
    );
}

function pathWithin(path: string, parent: string): boolean {
  const relation = relative(resolve(parent), resolve(path));
  return relation === "" ||
    (!isAbsolute(relation) && relation.split(/[\\/]/, 1)[0] !== "..");
}
