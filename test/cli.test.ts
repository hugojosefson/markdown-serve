import { assert, assertMatch } from "@std/assert";

Deno.test("direct CLI watches only its entry module", async () => {
  const source = await Deno.readTextFile(
    new URL("../src/cli.ts", import.meta.url),
  );
  assertMatch(source, /exec deno run --watch="\$0" \$A/);
  assert(!source.includes('DENO_RUN_ARGS="--watch'));
  assertMatch(source, /for executable in "\$browser_opener" git fd fdfind rg/);
  assertMatch(source, /run_commands:\+ --allow-run=\$\{run_commands\}/);
  assert(!source.includes("--watch-hmr"));
  assertMatch(source, /MARKDOWN_SERVE_BROWSER_OPENED/);
});
