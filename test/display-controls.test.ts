import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  displayControlsClient,
  displayInitialClient,
} from "../src/server/display-controls-client.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("display controls expose accessible theme and width state", async () => {
  const f = await fixture({ "guide.md": "guide" });
  try {
    const body = await (await (await handler(f.root))(
      new Request("http://x/guide"),
    )).text();
    assertMatch(body, /<fieldset class="display-controls"><legend>Display/);
    assertMatch(body, /<select name="theme" aria-label="Theme">/);
    assertMatch(body, /<option value="auto">Auto/);
    assertMatch(body, /<option value="light">Light/);
    assertMatch(body, /<option value="dark">Dark/);
    assertMatch(
      body,
      /<select name="width" aria-label="Width" aria-keyshortcuts="w">/,
    );
    assertMatch(body, /<option value="wide">Wide/);
    assertMatch(body, /html\[data-width="wide"\] \.layout/);
    assert(
      body.indexOf(displayInitialClient) < body.indexOf("<style>"),
      "applies query display state before the stylesheet can paint",
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("display state validates and updates without navigation", () => {
  assertMatch(
    displayInitialClient,
    /new URLSearchParams\(location.search\)/,
  );
  assertMatch(displayInitialClient, /\['auto', 'light', 'dark'\]/);
  assertMatch(displayInitialClient, /\['auto', 'wide'\]/);
  assert(!displayInitialClient.includes("history.replaceState"));
  assertMatch(displayControlsClient, /addEventListener\('popstate'/);
  assertMatch(displayControlsClient, /history.replaceState/);
  assertMatch(displayControlsClient, /url.searchParams.set\('theme', theme\)/);
  assertMatch(displayControlsClient, /url.searchParams.set\('width', width\)/);
  assertMatch(displayControlsClient, /event.key !== 'w'/);
  assertMatch(displayControlsClient, /width === 'wide' \? 'auto' : 'wide'/);
  assertMatch(displayControlsClient, /\[contenteditable\]/);
});

Deno.test("initial display state applies query parameters", () => {
  const apply = (search: string) => {
    const document = {
      documentElement: { dataset: {} as Record<string, string> },
    };
    new Function("location", "document", displayInitialClient)(
      { search },
      document,
    );
    return document.documentElement.dataset;
  };
  assertEquals(apply("?theme=dark&width=wide"), {
    colorMode: "dark",
    width: "wide",
  });
  assertEquals(apply(""), { colorMode: "auto", width: "auto" });
});
