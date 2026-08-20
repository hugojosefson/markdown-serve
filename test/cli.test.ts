import { assert, assertMatch } from "@std/assert";

Deno.test("direct CLI runs restart cleanly when source modules change", async () => {
  const source = await Deno.readTextFile(
    new URL("../src/cli.ts", import.meta.url),
  );
  assertMatch(source, /DENO_RUN_ARGS="--watch /);
  assert(!source.includes("--watch-hmr"));
  assertMatch(source, /MARKDOWN_SERVER_BROWSER_OPENED/);
});
