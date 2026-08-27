import { assertEquals } from "@std/assert";
import {
  childTerminator,
  terminateChild,
} from "../src/server/terminate-child.ts";

Deno.test("termination escalates when SIGTERM does not settle the child", async () => {
  let settle!: () => void;
  const signals: Deno.Signal[] = [];
  const status = new Promise<Deno.CommandStatus>((resolve) => {
    settle = () => resolve({ success: false, code: 137, signal: "SIGKILL" });
  });
  await terminateChild({
    status,
    kill(signal: Deno.Signal = "SIGTERM") {
      signals.push(signal);
      if (signal === "SIGKILL") settle();
    },
  }, 1);
  assertEquals(signals, ["SIGTERM", "SIGKILL"]);
});

Deno.test("termination status remains bounded when a child never settles", async () => {
  const signals: Deno.Signal[] = [];
  const child = {
    status: new Promise<Deno.CommandStatus>(() => {}),
    kill(signal: Deno.Signal = "SIGTERM") {
      signals.push(signal);
    },
  };
  const terminator = childTerminator(child, 1);
  terminator.stop();
  assertEquals(await terminator.status, undefined);
  assertEquals(signals, ["SIGTERM", "SIGKILL"]);
});
