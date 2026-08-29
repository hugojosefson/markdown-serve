import { isAbsolute, relative, resolve } from "@std/path";
import type { ReloadSource } from "./reload-source.ts";
import { ActiveFilePoller } from "./active-file-poller.ts";

type WatchedReloadSource = ReloadSource & { close(): void };
type ReloadSubscriber = {
  notify: () => void | Promise<void>;
  close?: () => void;
};
type WatchOperation = (
  path: string,
  options?: { recursive?: boolean },
) => Deno.FsWatcher;

export function createReloadWatcher(
  root: string,
  signal?: AbortSignal,
  ignorePaths: string[] = [],
  watchFs: WatchOperation = Deno.watchFs,
  pollIntervalMs = 1_000,
): WatchedReloadSource {
  const rootPath = resolve(root);
  try {
    return new ReloadHub(
      watchFs(rootPath),
      signal,
      ignorePaths,
      pollIntervalMs,
    );
  } catch (error) {
    if (error instanceof Deno.errors.PermissionDenied) {
      try {
        // Recursive setup traverses every descendant. Fall back to the root
        // watch when an unreadable child prevents that setup.
        return new ReloadHub(
          watchFs(rootPath, { recursive: false }),
          signal,
          ignorePaths,
          pollIntervalMs,
        );
      } catch (fallbackError) {
        // A denied root remains fatal. Other watcher failures retain active
        // file polling; createRequestHandler validates the root separately.
        if (fallbackError instanceof Deno.errors.PermissionDenied) {
          throw fallbackError;
        }
      }
    }
    return new ReloadHub(undefined, signal, ignorePaths, pollIntervalMs);
  }
}

export class ReloadHub implements WatchedReloadSource {
  #closed = false;
  #subscribers = new Set<ReloadSubscriber>();
  #timer?: ReturnType<typeof setTimeout>;
  #notifications = Promise.resolve();
  #watcher?: Deno.FsWatcher;
  readonly #poller: ActiveFilePoller;
  readonly #signal?: AbortSignal;
  readonly #ignorePaths: string[];

  constructor(
    watcher: Deno.FsWatcher | undefined,
    signal?: AbortSignal,
    ignorePaths: string[] = [],
    pollIntervalMs = 1_000,
  ) {
    this.#watcher = watcher;
    this.#poller = new ActiveFilePoller(
      () => this.scheduleReload(),
      Deno.stat,
      pollIntervalMs,
    );
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

  trackViewedFile(path: string, renderedRevision: string): () => void {
    return this.#poller.track(path, renderedRevision);
  }

  close = (): void => {
    if (this.#closed) {
      return;
    }

    this.#closed = true;
    this.#signal?.removeEventListener("abort", this.close);
    this.#watcher?.close();
    this.#watcher = undefined;
    this.#poller.close();
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
      const watcher = this.#watcher;
      if (!watcher) return;
      for await (const event of watcher) {
        if (reloadEventRelevant(event, this.#ignorePaths)) {
          this.scheduleReload();
        } else {
          this.cancelScheduledReload();
        }
      }
    } catch {
      // A failed recursive watcher (for example exhausted inotify watches) must
      // not disconnect clients: their displayed files remain polled.
    } finally {
      if (!this.#closed && this.#watcher) {
        this.#watcher.close();
        this.#watcher = undefined;
      }
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
