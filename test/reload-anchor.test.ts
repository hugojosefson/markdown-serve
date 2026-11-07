import { assertEquals } from "@std/assert";
import { reloadClientScript } from "../src/server/reload-client.ts";

type Options = {
  href?: string;
  navigation?: string;
  persisted?: boolean;
  editor?: boolean;
  missing?: boolean;
};

function reloadPage(options: Options = {}) {
  const ids: string[] = [];
  const scrolls: unknown[] = [];
  const frames: Array<() => void> = [];
  const listeners = new Map<string, (event: { persisted: boolean }) => void>();
  const location = { href: options.href ?? "http://x/guide.md#section" };
  class EventSource {
    addEventListener(): void {}
    close(): void {}
  }
  new Function(
    "EventSource",
    "location",
    "document",
    "globalThis",
    reloadClientScript,
  )(
    EventSource,
    location,
    {
      addEventListener: () => {},
      querySelector: () => options.editor ? {} : null,
      getElementById: (id: string) => {
        ids.push(id);
        return options.missing ? null : {
          scrollIntoView: (settings: unknown) => scrolls.push(settings),
        };
      },
    },
    {
      addEventListener: (
        name: string,
        listener: (event: { persisted: boolean }) => void,
      ) => listeners.set(name, listener),
      performance: {
        getEntriesByType: () => [{ type: options.navigation ?? "reload" }],
      },
      requestAnimationFrame: (callback: () => void) => frames.push(callback),
    },
  );
  listeners.get("pageshow")!({ persisted: options.persisted ?? false });
  return { ids, scrolls, frames, location };
}

Deno.test("page reload scrolls to the URL anchor after page display", () => {
  const page = reloadPage();
  assertEquals(page.ids, []);
  assertEquals(page.frames.length, 1);
  page.frames[0]();
  assertEquals(page.ids, ["section"]);
  assertEquals(page.scrolls, [{ behavior: "instant", block: "start" }]);
});

Deno.test("page reload decodes URL anchors without CSS selectors", () => {
  for (
    const [fragment, id] of [["caf%C3%A9", "café"], ["a%3Ab", "a:b"], [
      "%zz",
      "%zz",
    ]]
  ) {
    const page = reloadPage({ href: `http://x/guide.md#${fragment}` });
    page.frames[0]();
    assertEquals(page.ids, [id]);
    assertEquals(page.scrolls.length, 1);
  }
});

Deno.test("page reload leaves missing anchors unchanged", () => {
  const page = reloadPage({ missing: true });
  page.frames[0]();
  assertEquals(page.scrolls, []);
});

Deno.test("anchor scroll does not replace navigation or editor restoration", () => {
  for (
    const options of [
      { href: "http://x/guide.md" },
      { navigation: "navigate" },
      { navigation: "back_forward" },
      { persisted: true },
      { editor: true },
    ]
  ) {
    const page = reloadPage(options);
    assertEquals(page.frames, []);
    assertEquals(page.scrolls, []);
  }
});

Deno.test("anchor scroll stops if the URL changes before the next frame", () => {
  const page = reloadPage();
  page.location.href = "http://x/other.md";
  page.frames[0]();
  assertEquals(page.ids, []);
  assertEquals(page.scrolls, []);
});
