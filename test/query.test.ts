import { assertEquals } from "@std/assert";
import {
  canonicalQuery,
  queryHref,
  retainQuery,
  setQuery,
} from "../src/server/query.ts";
import { navigationQueryClient } from "../src/server/client-query.ts";
import {
  markdownSourceHref,
  rawPageAction,
} from "../src/server/page-action.ts";
import { canonicalQueryFixtures } from "./query-fixtures.ts";

Deno.test("canonical queries sort decoded keys and values stably and preserve flags", () => {
  assertEquals(canonicalQuery("?z=2&a=2&a&a=1&z=1"), "a&a=1&a=2&z=1&z=2");
  assertEquals(queryHref("/guide", "?z=2&a=1"), "?a=1&z=2");
  assertEquals(queryHref("/guide", ""), "/guide");
  assertEquals(
    setQuery("?z=2&a=2&a=1&raw", "theme", "dark"),
    "a=1&a=2&raw&theme=dark&z=2",
  );
  assertEquals(setQuery("?raw&theme=dark", "theme", undefined), "raw");
  assertEquals(
    retainQuery("?a=1&order=size&theme=dark&wide", [
      "theme",
      "wide",
    ]),
    "theme=dark&wide",
  );
});

Deno.test("browser query source matches canonical query fixtures", () => {
  const browserCanonical = new Function(
    "search",
    `${navigationQueryClient}; return canonicalNavigationQuery(queryPairs(search));`,
  ) as (search: string) => string;
  for (const { search, canonical } of canonicalQueryFixtures) {
    assertEquals(canonicalQuery(search), canonical);
    assertEquals(browserCanonical(search), canonical);
  }
});

Deno.test("raw links are always query-relative and clean", () => {
  assertEquals(
    rawPageAction("text/plain").href,
    "?raw",
  );
});

Deno.test("Markdown source links preserve same-file query state", () => {
  const rendered = new URL(
    "http://x/guide?metadata&order=size&theme=dark&unknown=value&wide",
  );
  assertEquals(
    markdownSourceHref(rendered, false),
    "?metadata&source&theme=dark&wide",
  );
  const source = new URL(
    "http://x/guide?metadata&order=size&source&theme=dark&unknown=value&wide",
  );
  assertEquals(
    markdownSourceHref(source, true),
    "?metadata&theme=dark&wide",
  );
});
