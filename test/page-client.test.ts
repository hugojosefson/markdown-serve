import { assert, assertMatch } from "@std/assert";
import { pageClient } from "../src/server/page-client.ts";

Deno.test("lazy tree entries construct Files controls without index discovery", () => {
  assertMatch(pageClient, /const filesLink = \(href, name\)/);
  assertMatch(pageClient, /item\.className = 'tree-entry-row'/);
  assertMatch(
    pageClient,
    /const files = filesLink\(entry\.filesHref, entry\.filesLabel \?\? entry\.name\)/,
  );
  assert(!pageClient.includes("/__markdown_server__/index"));
  assert(!pageClient.includes("indexPending"));
});

Deno.test("loaded image previews are limited to four times intrinsic width", () => {
  const values = new Map<string, string>();
  const image = {
    complete: true,
    naturalWidth: 120,
    style: {
      setProperty: (name: string, value: string) => values.set(name, value),
    },
  };
  new Function(
    "document",
    "HTMLDetailsElement",
    "location",
    "syncNavigationLinks",
    pageClient,
  )(
    {
      querySelector: () => null,
      querySelectorAll: () => [image],
    },
    class {},
    { href: "http://x/" },
    () => {},
  );
  assertMatch(values.get("--image-max-width") ?? "", /^480px$/);
});
