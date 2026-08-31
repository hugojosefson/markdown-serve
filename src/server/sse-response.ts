import type { ReloadSource } from "./reload-source.ts";

export function sseResponse(
  source: ReloadSource,
  viewedFile?: { path: string; revision: string },
): Response {
  let unsubscribe: (() => void) | undefined;
  let untrack: (() => void) | undefined;
  let disposed = false;
  const run = (operation: (() => void) | undefined) => {
    try {
      operation?.();
    } catch {
      // Cleanup must continue when a custom reload source fails.
    }
  };
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    const stopSubscription = unsubscribe;
    const stopTracking = untrack;
    unsubscribe = undefined;
    untrack = undefined;
    run(stopSubscription);
    run(stopTracking);
  };
  const body = new ReadableStream({
    start(controller) {
      const send = () =>
        controller.enqueue(
          new TextEncoder().encode("event: reload\ndata: changed\n\n"),
        );
      const close = () => {
        if (disposed) {
          return;
        }
        try {
          controller.close();
        } finally {
          dispose();
        }
      };
      try {
        unsubscribe = source.subscribe(send, close);
        if (disposed) {
          const stop = unsubscribe;
          unsubscribe = undefined;
          return run(stop);
        }
        untrack = viewedFile && source.trackViewedFile?.(
          viewedFile.path,
          viewedFile.revision,
        );
        if (disposed) {
          const stop = untrack;
          untrack = undefined;
          run(stop);
        }
      } catch (error) {
        dispose();
        controller.error(error);
      }
    },
    cancel() {
      dispose();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
