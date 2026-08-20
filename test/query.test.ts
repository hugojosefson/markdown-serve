import { assertEquals } from "@std/assert";
import { canonicalQuery, queryHref, setQuery } from "../src/server/query.ts";
import { rawHref } from "../src/server/render-text.ts";

Deno.test("canonical queries sort decoded keys and values stably and preserve flags", () => {
  assertEquals(canonicalQuery("?z=2&a=2&a&a=1&z=1"), "a&a=1&a=2&z=1&z=2");
  assertEquals(queryHref("/guide", "?z=2&a=1"), "?a=1&z=2");
  assertEquals(queryHref("/guide", ""), "/guide");
  assertEquals(
    setQuery("?z=2&a=2&a=1&raw", "theme", "dark"),
    "a=1&a=2&raw&theme=dark&z=2",
  );
  assertEquals(setQuery("?raw&theme=dark", "theme", undefined), "raw");
});

Deno.test("raw links are always query-relative and clean", () => {
  assertEquals(
    rawHref(),
    "?raw",
  );
});
