import { resolve } from "@std/path";
import type { ReloadSource } from "./reload-source.ts";

type WatchedReloadSource = ReloadSource & { close(): void };

export function createReloadWatcher(
  root: string,
  signal?: AbortSignal,
): WatchedReloadSource {
  const listeners = new Set<{ notify: () => void; close?: () => void }>();
  const watcher = Deno.watchFs(resolve(root));
  const state: { closed: boolean; timer?: ReturnType<typeof setTimeout> } = {
    closed: false,
  };
  const close = () => {
    if (state.closed) {
      return;
    }
    state.closed = true;
    watcher.close();
    if (state.timer !== undefined) {
      clearTimeout(state.timer);
    }
    for (const listener of listeners) {
      listener.close?.();
    }
    listeners.clear();
    signal?.removeEventListener("abort", close);
  };
  signal?.addEventListener("abort", close, { once: true });
  void watch(watcher, listeners, state, close);
  return {
    close,
    subscribe: (notify, onClose) => subscribe(listeners, notify, onClose),
  };
}

async function watch(
  watcher: Deno.FsWatcher,
  listeners: Set<{ notify: () => void }>,
  state: { timer?: ReturnType<typeof setTimeout> },
  close: () => void,
): Promise<void> {
  try {
    for await (const _event of watcher) {
      if (state.timer !== undefined) {
        clearTimeout(state.timer);
      }
      state.timer = setTimeout(
        () => listeners.forEach((listener) => listener.notify()),
        50,
      );
    }
  } catch {
    close();
  }
}

function subscribe(
  listeners: Set<{ notify: () => void; close?: () => void }>,
  notify: () => void,
  close?: () => void,
): () => void {
  const listener = { notify, close };
  listeners.add(listener);
  return () => listeners.delete(listener);
}
