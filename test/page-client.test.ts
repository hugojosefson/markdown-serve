import { assert, assertEquals, assertMatch } from "@std/assert";
import { pageClient } from "../src/server/page-client.ts";
import { relativeTimeClient } from "../src/server/relative-time-client.ts";
import { fileSearchClient } from "../src/server/file-search-client.ts";

Deno.test("lazy tree entries construct Files controls without index discovery", () => {
  assertMatch(pageClient, /const filesLink = \(href, name\)/);
  assertMatch(pageClient, /filesLink\.dataset\.queryScope = 'directory'/);
  assertMatch(pageClient, /item\.className = 'tree-entry-row'/);
  assertMatch(
    pageClient,
    /const files = filesLink\(entry\.filesHref, entry\.filesLabel \?\? entry\.name\)/,
  );
  assert(!pageClient.includes("/__markdown_serve__/index"));
  assert(!pageClient.includes("indexPending"));
  assertMatch(pageClient, /details\.dataset\.loading === 'true'/);
  assertMatch(pageClient, /delete details\.dataset\.loading/);
});

Deno.test("lazy tree expansion ignores duplicate requests while loading", async () => {
  let toggle: (event: { target: Details }) => Promise<void> = async () => {};
  let requests = 0;
  let finish!: (value: { ok: false }) => void;
  class Details {
    open = true;
    dataset: Record<string, string> = { path: "src" };
    matches = () => true;
  }
  const tree = {
    querySelector: () => null,
    addEventListener: (type: string, listener: typeof toggle) => {
      if (type === "toggle") toggle = listener;
    },
  };
  new Function(
    "document",
    "HTMLDetailsElement",
    "location",
    "syncNavigationLinks",
    "fetch",
    pageClient,
  )(
    { querySelector: () => tree, querySelectorAll: () => [] },
    Details,
    { href: "http://x/" },
    () => {},
    () => {
      requests++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
  );
  const details = new Details();
  const first = toggle({ target: details });
  const second = toggle({ target: details });
  assertEquals(requests, 1);
  finish({ ok: false });
  await Promise.all([first, second]);
  assertEquals(details.dataset.loading, undefined);
});

Deno.test("relative-time client uses one visibility-aware scheduler", () => {
  assertMatch(
    relativeTimeClient,
    /querySelectorAll\('\[data-relative-time\]'\)/,
  );
  assertMatch(relativeTimeClient, /let relativeTimeTimer/);
  assertMatch(relativeTimeClient, /document\.hidden/);
  assertMatch(relativeTimeClient, /visibilitychange/);
  assertMatch(relativeTimeClient, /new Intl\.RelativeTimeFormat\('en'/);
});

Deno.test("relative-time client updates labels and caps long timers", () => {
  const now = Date.parse("2020-01-01T00:00:00.000Z");
  const element = {
    dataset: { relativeTime: "2010-01-01T00:00:00.000Z" },
    textContent: "",
  };
  let delay = 0;
  class ClockDate extends Date {
    static override now(): number {
      return now;
    }
  }
  new Function(
    "document",
    "Date",
    "setTimeout",
    "clearTimeout",
    relativeTimeClient,
  )(
    {
      hidden: false,
      querySelectorAll: () => [element],
      addEventListener: () => {},
    },
    ClockDate,
    (_callback: () => void, milliseconds: number) => {
      delay = milliseconds;
      return 1;
    },
    () => {},
  );
  assertEquals(element.textContent, "10 years ago");
  assertEquals(delay, 2_147_483_647);
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

Deno.test("go-to-file client opens, filters, and supports keyboard navigation", () => {
  assertMatch(fileSearchClient, /event\.key !== 'g'/);
  assertMatch(fileSearchClient, /goToFileScope/);
  assertMatch(fileSearchClient, /ArrowDown/);
  assertMatch(fileSearchClient, /ArrowUp/);
  assertMatch(fileSearchClient, /event\.key === 'Enter'/);
  assertMatch(fileSearchClient, /event\.key === 'Escape'/);
  assertMatch(fileSearchClient, /AbortController/);
  assertMatch(fileSearchClient, /textContent = file\.name/);
});

Deno.test("go-to-file client loads, selects, and aborts its dialog request", async () => {
  type Listener = (event: { key?: string; preventDefault: () => void }) => void;
  class Element {
    children: Element[] = [];
    dataset: Record<string, string> = {};
    listeners = new Map<string, Listener[]>();
    textContent = "";
    value = "";
    focused = false;
    scrolled = false;
    append(...children: Element[]) {
      this.children.push(...children);
    }
    replaceChildren(...children: Element[]) {
      this.children = children;
    }
    addEventListener(type: string, listener: Listener) {
      this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    }
    dispatch(
      type: string,
      event: { key?: string; preventDefault: () => void } = {
        preventDefault: () => {},
      },
    ) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }
    focus() {
      this.focused = true;
    }
    scrollIntoView() {
      this.scrolled = true;
    }
    querySelector(selector: string) {
      if (selector === '[data-selected="true"]') {
        return this.children.find((child) => child.dataset.selected === "true");
      }
      return undefined;
    }
  }
  class Dialog extends Element {
    input = new Element();
    list = new Element();
    status = new Element();
    open = false;
    showModal() {
      this.open = true;
    }
    close() {
      this.open = false;
      this.dispatch("close");
    }
    override querySelector(selector: string) {
      return selector === "input"
        ? this.input
        : selector === "ul"
        ? this.list
        : selector === ".go-to-file-status"
        ? this.status
        : super.querySelector(selector);
    }
  }
  const dialog = new Dialog();
  const body = new Element();
  body.dataset.goToFileScope = "docs";
  const listeners = new Map<string, Listener[]>();
  let signal: { aborted: boolean } | undefined;
  class Controller {
    signal = { aborted: false };
    abort() {
      this.signal.aborted = true;
    }
  }
  new Function(
    "document",
    "fetch",
    "AbortController",
    "location",
    fileSearchClient,
  )(
    {
      body,
      createElement: (name: string) =>
        name === "dialog" ? dialog : new Element(),
      addEventListener: (type: string, listener: Listener) =>
        listeners.set(type, [...(listeners.get(type) ?? []), listener]),
    },
    (_url: string, options: { signal: { aborted: boolean } }) => {
      signal = options.signal;
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve([
            { name: "a.txt", href: "/docs/a.txt" },
            { name: "b.txt", href: "/docs/b.txt" },
          ]),
      });
    },
    Controller,
    { assign: () => {} },
  );
  listeners.get("keydown")?.[0]({ key: "g", preventDefault: () => {} });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(
    [dialog.open, dialog.input.focused, dialog.list.children.length],
    [
      true,
      true,
      2,
    ],
  );
  dialog.dispatch("keydown", { key: "ArrowDown", preventDefault: () => {} });
  assertEquals(dialog.list.children[1].dataset.selected, "true");
  assertEquals(dialog.list.children[1].scrolled, true);
  dialog.input.value = "b";
  dialog.input.dispatch("input");
  assertEquals(
    [
      dialog.list.children.length,
      dialog.list.children[0].children[0].textContent,
    ],
    [1, "b.txt"],
  );
  dialog.close();
  assertEquals(signal?.aborted, true);
});
