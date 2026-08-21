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
    displayHref(
      at(
        "?dir&keep=value&metadata=expand&order=size&raw&source&theme=dark&width=wide",
      ),
      "theme",
    ),
    "?metadata=expand&source&theme=light&width=wide",
  );
  assertEquals(
    displayHref(
      at(
        "?dir&keep=value&metadata=expand&order=size&raw&source&theme=dark&width=wide",
      ),
      "width",
    ),
    "?metadata=expand&source&theme=dark",
  );
  assertEquals(
    displayHref(
      at("?dir&metadata=expand&order=size&source&theme=dark"),
      "theme",
      true,
    ),
    "?dir&order=size&theme=light",
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
      /display-group display-theme[\s\S]*href="\?theme=light&amp;width=wide"/,
    );
    assertMatch(
      body,
      /display-group display-width[\s\S]*Switch to narrow/,
    );
    assert(!body.includes("display-menu"));
    assert(!body.includes("<select"));
    assert(!body.includes('<details class="display'));
    assert(
      body.indexOf(displayInitialClient) < body.indexOf('rel="stylesheet"'),
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

Deno.test("client scopes global and directory query state across navigation", () => {
  const listeners = new Map<string, (event: { key?: string }) => void>();
  const location = {
    href:
      "http://x/guide?dir&download&flag&metadata=expand&order=size&raw&source&unknown=one&unknown=two&theme=dark&width=wide",
    origin: "http://x",
    search:
      "?dir&download&flag&metadata=expand&order=size&raw&source&unknown=one&unknown=two&theme=dark&width=wide",
  };
  let ordinaryHref = "docs";
  let overrideHref = "/files?order=name&order=modified&unknown=target";
  let absoluteHref = "http://x/root?dir#section";
  let optionHref = "?theme=dark";
  let sourceHref = "?source";
  let directoryHref = "/folder/?dir";
  let externalHref = "https://example.test/docs?x=1";
  let hashHref = "#browse";
  let rawHref = "?raw";
  let downloadHref = "?download";
  let metadataHref = "?theme=dark";
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
    scope?: string,
  ) => ({
    getAttribute: (name: string) =>
      name === "href"
        ? get()
        : name === "data-query-remove"
        ? remove ?? null
        : name === "data-query-scope"
        ? scope ?? null
        : null,
    setAttribute: (_name: string, value: string) => set(value),
    matches: () => false,
  });
  const override = link(() => overrideHref, (value) => overrideHref = value);
  const absolute = link(() => absoluteHref, (value) => absoluteHref = value);
  const source = link(() => sourceHref, (value) => sourceHref = value);
  const directory = link(
    () => directoryHref,
    (value) => directoryHref = value,
    undefined,
    "directory",
  );
  const external = link(() => externalHref, (value) => externalHref = value);
  const hash = link(() => hashHref, (value) => hashHref = value);
  const raw = {
    getAttribute: (name: string) => name === "href" ? rawHref : null,
    setAttribute: (_name: string, value: string) => rawHref = value,
    matches: (selector: string) => selector.includes(".raw-link"),
  };
  const download = {
    getAttribute: (name: string) => name === "href" ? downloadHref : null,
    setAttribute: (_name: string, value: string) => downloadHref = value,
    matches: (selector: string) => selector.includes(".download-link"),
  };
  const metadata = {
    getAttribute: (name: string) => name === "href" ? metadataHref : null,
    setAttribute: (_name: string, value: string) => metadataHref = value,
    matches: (selector: string) => selector.includes(".file-metadata"),
  };
  const width = { querySelector: () => ({ click: () => clicked++ }) };
  const document = {
    documentElement: {
      dataset: { directoryView: "false" } as Record<string, string>,
    },
    querySelector: (selector: string) =>
      selector.includes("display-width") ? width : null,
    querySelectorAll: () => [
      ordinary,
      override,
      absolute,
      source,
      directory,
      option,
      external,
      hash,
      raw,
      download,
      metadata,
    ],
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
    "docs?theme=dark&width=wide",
  );
  assertEquals(metadataHref, "?theme=dark");
  assertEquals(
    overrideHref,
    "/files?order=modified&order=name&theme=dark&unknown=target&width=wide",
  );
  assertEquals(
    absoluteHref,
    "http://x/root?dir&theme=dark&width=wide#section",
  );
  assertEquals(optionHref, "?theme=dark");
  assertEquals(
    sourceHref,
    "?source&theme=dark&width=wide",
  );
  assertEquals(
    directoryHref,
    "/folder/?dir&theme=dark&width=wide",
  );
  assertEquals(externalHref, "https://example.test/docs?x=1");
  assertEquals(hashHref, "#browse");
  assertEquals(rawHref, "?raw");
  assertEquals(downloadHref, "?download");
  listeners.get("keydown")?.({ key: "w" });
  assertEquals(clicked, 1);
  location.search = "?order=size-desc&new&unknown=changed";
  listeners.get("popstate")?.({});
  assertEquals(document.documentElement.dataset, {
    colorMode: "auto",
    directoryView: "false",
    width: "narrow",
  });
  assertEquals(ordinaryHref, "docs");
  assertEquals(
    overrideHref,
    "/files?order=modified&order=name&unknown=target",
  );
  assertEquals(directoryHref, "/folder/?dir");
  assertEquals(downloadHref, "?download");
  let indexHref = "/docs/";
  const index = link(() => indexHref, (value) => indexHref = value, "dir");
  let filesHref = "/docs/?dir";
  const files = link(
    () => filesHref,
    (value) => filesHref = value,
    undefined,
    "directory",
  );
  let nameHref = "/docs/?dir";
  const name = link(
    () => nameHref,
    (value) => nameHref = value,
    "order",
    "directory",
  );
  document.querySelectorAll = () => [index, files, name];
  document.documentElement.dataset.directoryView = "true";
  location.search = "?dir&order=size&theme=dark&unknown=value";
  listeners.get("popstate")?.({});
  assertEquals(indexHref, "/docs/?theme=dark");
  assertEquals(filesHref, "/docs/?dir&order=size&theme=dark");
  assertEquals(nameHref, "/docs/?dir&theme=dark");
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
