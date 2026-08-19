import { assertMatch } from "@std/assert";

Deno.test("direct CLI runs use Deno hot module replacement", async () => {
  const source = await Deno.readTextFile(
    new URL("../src/cli.ts", import.meta.url),
  );
  assertMatch(source, /DENO_RUN_ARGS="--watch-hmr /);
});
