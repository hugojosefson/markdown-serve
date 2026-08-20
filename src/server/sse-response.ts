import type { ReloadSource } from "./reload-source.ts";

export function sseResponse(source: ReloadSource): Response {
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) {
      return;
    }
    disposed = true;
    unsubscribe?.();
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
        controller.close();
        dispose();
      };
      unsubscribe = source.subscribe(send, close);
      if (disposed) {
        unsubscribe();
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
