import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  displayHref,
  displayLinks,
  displayState,
} from "../src/server/display-links.ts";
import {
  displayControlsClient,
  displayInitialClient,
} from "../src/server/display-controls-client.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("display links use segmented direct states and canonical queries", () => {
  const at = (search: string) => new URL(`http://x/guide${search}`);
  assertEquals(displayState(at("?theme=nope&width=nope")), {
    theme: "auto",
    width: "narrow",
  });
  assertEquals(displayState(at("?width=auto")).width, "narrow");
  assertEquals(displayHref(at(""), "theme"), "?theme=dark");
  assertEquals(
    displayHref(at("?theme=invalid"), "theme"),
    "?theme=dark",
  );
  assertEquals(displayHref(at("?theme=light"), "theme"), "/guide");
  assertEquals(displayHref(at("?theme=dark"), "theme"), "?theme=light");
  assertEquals(displayHref(at(""), "width"), "?width=wide");
  assertEquals(displayHref(at("?width=wide"), "width"), "/guide");
  assertEquals(
    displayHref(at("?raw&theme=dark&width=wide&keep=value"), "theme"),
    "?keep=value&raw&theme=light&width=wide",
  );
  assertEquals(
    displayHref(at("?raw&theme=dark&width=wide&keep=value"), "width"),
    "?keep=value&raw&theme=dark",
  );
  assertMatch(
    displayLinks(at("?theme=dark&width=wide")),
    /display-group display-theme[\s\S]*title="Switch to light \(t\)" aria-keyshortcuts="t"[\s\S]*Dark selected[\s\S]*aria-current="true"/,
  );
  assertMatch(
    displayLinks(at("?theme=dark&width=wide")),
    /display-group display-width[\s\S]*title="Switch to narrow \(w\)" aria-keyshortcuts="w"[\s\S]*Wide selected[\s\S]*<svg/,
  );
  assertMatch(
    displayLinks(at("")),
    /title="Switch to dark \(t\)" aria-keyshortcuts="t"/,
  );
});

Deno.test("pages render display anchors without a menu or selects", async () => {
  const f = await fixture({ "guide.md": "guide" });
  try {
    const body = await (await (await handler(f.root))(
      new Request("http://x/guide?theme=light&width=wide&keep=yes"),
    )).text();
    assertMatch(
      body,
      /display-group display-theme[\s\S]*href="\?keep=yes&amp;theme=light&amp;width=wide"/,
    );
    assertMatch(
      body,
      /display-group display-width[\s\S]*Switch to narrow/,
    );
    assert(!body.includes("display-menu"));
    assert(!body.includes("<select"));
    assert(!body.includes('<details class="display'));
    assert(
      body.indexOf(displayInitialClient) < body.indexOf("<style>"),
      "applies query display state before the stylesheet can paint",
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("initial display state applies valid query values", () => {
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
  };
  new Function("location", "document", displayInitialClient)(
    { search: "?theme=dark&width=wide" },
    document,
  );
  assertEquals(document.documentElement.dataset, {
    colorMode: "dark",
    width: "wide",
  });
});

Deno.test("client carries all current query state across internal navigation", () => {
  const listeners = new Map<string, (event: { key?: string }) => void>();
  const location = {
    href:
      "http://x/guide?order=size&unknown=one&unknown=two&flag&theme=dark&width=wide",
    origin: "http://x",
    search: "?order=size&unknown=one&unknown=two&flag&theme=dark&width=wide",
  };
  let ordinaryHref = "docs";
  let overrideHref = "/files?order=name&order=modified&unknown=target";
  let absoluteHref = "http://x/root?dir#section";
  let optionHref = "?theme=dark";
  let externalHref = "https://example.test/docs?x=1";
  let hashHref = "#browse";
  let rawHref = "?raw";
  let clicked = 0;
  const ordinary = {
    getAttribute: (name: string) => name === "href" ? ordinaryHref : null,
    setAttribute: (_name: string, value: string) => ordinaryHref = value,
    matches: () => false,
  };
  const option = {
    getAttribute: (name: string) => name === "href" ? optionHref : null,
    setAttribute: (_name: string, value: string) => optionHref = value,
    matches: () => true,
  };
  const link = (
    get: () => string,
    set: (value: string) => void,
    remove?: string,
  ) => ({
    getAttribute: (name: string) =>
      name === "href"
        ? get()
        : name === "data-query-remove"
        ? remove ?? null
        : null,
    setAttribute: (_name: string, value: string) => set(value),
    matches: () => false,
  });
  const override = link(() => overrideHref, (value) => overrideHref = value);
  const absolute = link(() => absoluteHref, (value) => absoluteHref = value);
  const external = link(() => externalHref, (value) => externalHref = value);
  const hash = link(() => hashHref, (value) => hashHref = value);
  const raw = {
    getAttribute: (name: string) => name === "href" ? rawHref : null,
    setAttribute: (_name: string, value: string) => rawHref = value,
    matches: (selector: string) => selector.includes(".raw-link"),
  };
  const width = { querySelector: () => ({ click: () => clicked++ }) };
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    querySelector: (selector: string) =>
      selector.includes("display-width") ? width : null,
    querySelectorAll:
      () => [ordinary, override, absolute, option, external, hash, raw],
  };
  new Function(
    "location",
    "document",
    "addEventListener",
    displayControlsClient,
  )(
    location,
    document,
    (name: string, listener: (event: { key?: string }) => void) =>
      listeners.set(name, listener),
  );
  assertEquals(
    ordinaryHref,
    "docs?flag&order=size&theme=dark&unknown=one&unknown=two&width=wide",
  );
  assertEquals(
    overrideHref,
    "/files?flag&order=modified&order=name&theme=dark&unknown=target&width=wide",
  );
  assertEquals(
    absoluteHref,
    "http://x/root?dir&flag&order=size&theme=dark&unknown=one&unknown=two&width=wide#section",
  );
  assertEquals(optionHref, "?theme=dark");
  assertEquals(externalHref, "https://example.test/docs?x=1");
  assertEquals(hashHref, "#browse");
  assertEquals(rawHref, "?raw");
  listeners.get("keydown")?.({ key: "w" });
  assertEquals(clicked, 1);
  location.search = "?order=size-desc&new&unknown=changed";
  listeners.get("popstate")?.({});
  assertEquals(document.documentElement.dataset, {
    colorMode: "auto",
    width: "narrow",
  });
  assertEquals(ordinaryHref, "docs?new&order=size-desc&unknown=changed");
  assertEquals(
    overrideHref,
    "/files?new&order=modified&order=name&unknown=target",
  );
  let indexHref = "/docs/";
  const index = link(() => indexHref, (value) => indexHref = value, "dir");
  let filesHref = "/docs/?dir";
  const files = link(() => filesHref, (value) => filesHref = value);
  document.querySelectorAll = () => [index, files];
  location.search = "?dir&order=size&theme=dark&unknown=value";
  listeners.get("popstate")?.({});
  assertEquals(indexHref, "/docs/?order=size&theme=dark&unknown=value");
  assertEquals(filesHref, "/docs/?dir&order=size&theme=dark&unknown=value");
  assert(!displayControlsClient.includes("history.replaceState"));
  assert(!displayControlsClient.includes("syncDisplayLinks"));
  assertMatch(displayControlsClient, /addEventListener\('popstate'/);
});

Deno.test("keyboard shortcuts follow the next segmented links", () => {
  const listeners = new Map<string, (event: { key?: string }) => void>();
  const selected = { theme: 1, width: 0 };
  const clicks: string[] = [];
  const group = (name: "theme" | "width", values: string[]) => {
    const links = values.map((value, index) => ({
      get nextElementSibling() {
        return links[index + 1] ?? null;
      },
      click: () => {
        selected[name] = index;
        clicks.push(value);
      },
    }));
    return {
      querySelector: (selector: string) =>
        selector.startsWith("[aria-current") ? links[selected[name]] : links[0],
    };
  };
  const theme = group("theme", ["light", "auto", "dark"]);
  const width = group("width", ["narrow", "wide"]);
  const document = {
    documentElement: { dataset: {} as Record<string, string> },
    querySelector: (selector: string) =>
      selector === ".display-theme" ? theme : width,
    querySelectorAll: () => [],
  };
  new Function(
    "location",
    "document",
    "addEventListener",
    displayControlsClient,
  )(
    { href: "http://x/guide", origin: "http://x", search: "" },
    document,
    (name: string, listener: (event: { key?: string }) => void) =>
      listeners.set(name, listener),
  );
  for (const key of ["t", "t", "t", "w", "w"]) {
    listeners.get("keydown")?.({ key });
  }
  assertEquals(clicks, ["dark", "light", "auto", "wide", "narrow"]);
});
