import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { packageSourcePaths } from "../src/cli/package-source-paths.ts";

Deno.test("package source paths are local-only", () => {
  assertEquals(
    packageSourcePaths(
      "https://jsr.io/@hugojosefson/markdown-serve/0.1.3/src/cli/port.ts",
    ),
    [],
  );
  assertEquals(
    packageSourcePaths(new URL("../src/cli/port.ts", import.meta.url)),
    [
      fromFileUrl(new URL("../src/", import.meta.url)),
      fromFileUrl(new URL("../deno.json", import.meta.url)),
      fromFileUrl(new URL("../deno.lock", import.meta.url)),
    ],
  );
});
