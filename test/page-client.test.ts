import { assert, assertEquals, assertMatch } from "@std/assert";
import { pageClient } from "../src/server/page-client.ts";
import { relativeTimeClient } from "../src/server/relative-time-client.ts";

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
