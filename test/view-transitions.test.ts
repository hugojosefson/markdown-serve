import { assert, assertEquals, assertMatch } from "@std/assert";
import { pageStylesheet } from "../src/server/page-assets.ts";
import { navigationSpeculation } from "../src/server/navigation-speculation.ts";
import { viewTransitionClient } from "../src/server/view-transition-client.ts";

Deno.test("page CSS opts into cross-document transitions only when motion is allowed", () => {
  assertMatch(
    pageStylesheet.body,
    /@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /::view-transition-group\(root\), ::view-transition-old\(root\), ::view-transition-new\(root\) \{ animation-duration: 120ms; animation-timing-function: ease-out; \}/,
  );
});

Deno.test("metadata expansion separates moving content and details", () => {
  assertMatch(
    pageStylesheet.body,
    /\.content-header \.file-metadata \{ view-transition-name: file-metadata; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /\.content:has\(\.file-metadata\) \.page-content \{ view-transition-name: file-content; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /\.file-metadata-details \{ view-transition-name: file-metadata-details; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /::view-transition-new\(file-metadata-details\):only-child \{ animation: 140ms ease-out both metadata-details-in; transform-origin: top; \}/,
  );
});

Deno.test("query navigation skips transitions except metadata-only changes", () => {
  let pageswap: (event: {
    activation?: { from?: { url: string }; entry?: { url: string } };
    viewTransition?: { skipTransition: () => void };
  }) => void = () => {};
  new Function("addEventListener", viewTransitionClient)(
    (name: string, listener: typeof pageswap) => {
      if (name === "pageswap") {
        pageswap = listener;
      }
    },
  );
  const skips = (from: string, to: string) => {
    let count = 0;
    pageswap({
      activation: { from: { url: from }, entry: { url: to } },
      viewTransition: { skipTransition: () => count++ },
    });
    return count;
  };
  assertEquals(skips("http://x/readme/", "http://x/readme/?source"), 1);
  assertEquals(skips("http://x/readme/?theme=dark", "http://x/readme/"), 1);
  assertEquals(
    skips("http://x/readme/", "http://x/readme/?metadata"),
    0,
  );
  assertEquals(
    skips(
      "http://x/readme/?metadata=one",
      "http://x/readme/?metadata=two",
    ),
    1,
  );
  assertEquals(
    skips(
      "http://x/readme/?metadata&source",
      "http://x/readme/",
    ),
    1,
  );
  assertEquals(skips("http://x/readme/", "http://x/guide/"), 0);
});

Deno.test("speculative prefetch excludes file view actions", () => {
  assert(!navigationSpeculation.includes(".file-action"));
  assert(navigationSpeculation.includes(".file-metadata"));
});
