import type { ReloadSource } from "./reload-source.ts";

export function sseResponse(source: ReloadSource): Response {
  const state: { unsubscribe: () => void } = { unsubscribe: () => {} };
  const body = new ReadableStream({
    start(controller) {
      const send = () =>
        controller.enqueue(
          new TextEncoder().encode("event: reload\ndata: changed\n\n"),
        );
      state.unsubscribe = source.subscribe(send, () => controller.close());
    },
    cancel() {
      state.unsubscribe();
    },
  });
  return new Response(body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}
