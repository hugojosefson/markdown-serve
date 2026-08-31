import { assertEquals } from "@std/assert";
import { installDialogDismissal } from "../src/server/dialog-dismissal-client.ts";

Deno.test("dialog dismissal closes only its backdrop and cleans up after native close", () => {
  const listeners = new Map<string, ((event: { target: unknown }) => void)[]>();
  let closed = 0;
  const dialog = {
    addEventListener(
      type: string,
      listener: (event: { target: unknown }) => void,
    ) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    close() {
      closed++;
      listeners.get("close")?.forEach((listener) =>
        listener({ target: dialog })
      );
    },
  };
  let cleanup = 0;
  installDialogDismissal(dialog, () => cleanup++);
  listeners.get("click")?.[0]({ target: {} });
  listeners.get("click")?.[0]({ target: dialog });
  assertEquals([closed, cleanup], [1, 1]);
});
