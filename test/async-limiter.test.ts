import { assertEquals, assertRejects } from "@std/assert";
import { AsyncLimiter } from "../src/server/async-limiter.ts";

Deno.test("async limiter bounds concurrency and continues after failures", async () => {
  const limiter = new AsyncLimiter(3);
  let active = 0;
  let maximum = 0;
  const operations = Array.from(
    { length: 12 },
    (_, index) =>
      limiter.run(async () => {
        active++;
        maximum = Math.max(maximum, active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return index;
      }),
  );
  assertEquals(
    await Promise.all(operations),
    Array.from({ length: 12 }, (_, i) => i),
  );
  assertEquals(maximum, 3);

  await assertRejects(() =>
    limiter.run(() => {
      throw new Error("synchronous failure");
    })
  );
  assertEquals(
    await limiter.run(() => Promise.resolve("continued")),
    "continued",
  );
});
