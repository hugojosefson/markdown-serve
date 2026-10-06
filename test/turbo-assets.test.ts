import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  pageAsset,
  pageScript,
  pageStylesheet,
  turboScript,
} from "../src/server/page-assets.ts";
import { clientLifecycle } from "../src/server/client-lifecycle.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("Turbo is a hashed immutable self-hosted page asset", () => {
  assertMatch(turboScript.url, /\/assets\/turbo-[a-f0-9]{64}\.js$/);
  assert(turboScript.body.includes("Turbo"));
  assertEquals(pageAsset(turboScript.url), turboScript);
  assertEquals(pageAsset(pageScript.url), pageScript);
  assert(pageScript.body.includes("turbo:load"));
  assert(pageScript.body.includes("turbo:before-cache"));
  assertEquals(new Function(pageScript.body) instanceof Function, true);
});

Deno.test("generated pages load Turbo before the persistent page client", async () => {
  const f = await fixture({
    "guide.md": "# Guide",
    "note.txt": "note",
  });
  try {
    const h = await handler(f.root, { edit: true });
    const page = await (await h(new Request("http://x/guide"))).text();
    const turboTag =
      `<script src="${turboScript.url}" defer data-turbo-track="reload"></script>`;
    const clientTag =
      `<script src="${pageScript.url}" defer data-turbo-track="reload"></script>`;
    assert(page.indexOf(turboTag) < page.indexOf(clientTag));
    assertMatch(
      page,
      new RegExp(
        `<link rel="stylesheet" href="${pageStylesheet.url}" data-turbo-track="reload">`,
      ),
    );
    assertEquals(
      page.slice(page.indexOf("<body"), page.indexOf("</body>"))
        .includes(`<script src="${pageScript.url}"`),
      false,
    );
    assertMatch(page, /href="\?edit"[^>]*data-turbo="false"/);

    const edit = await (await h(new Request("http://x/note.txt?edit"))).text();
    assertMatch(edit, /<body data-turbo="false"/);
    assertMatch(edit, /<form class="edit-page"[^>]*data-turbo="false">/);

    const note = await (await h(new Request("http://x/note.txt"))).text();
    assertMatch(note, /class="file-action raw-link"[^>]*data-turbo="false"/);
    assertMatch(
      note,
      /class="file-action download-link"[^>]*data-turbo="false"/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("page lifecycle initializes once per body and cleans cached pages", () => {
  type Listener = () => void;
  const listeners = new Map<string, Listener[]>();
  const firstBody = { dataset: { directoryView: "false" } };
  const document = {
    body: firstBody,
    documentElement: { dataset: {} as Record<string, string> },
    addEventListener: (name: string, listener: Listener) =>
      listeners.set(name, [...(listeners.get(name) ?? []), listener]),
  };
  const globalThis: Record<string, unknown> = {};
  new Function(
    "document",
    "globalThis",
    "AbortController",
    clientLifecycle,
  )(document, globalThis, AbortController);
  let initializations = 0;
  let cleanups = 0;
  const register = globalThis.markdownServeRegisterPageInitializer as (
    initializer: () => () => void,
  ) => void;
  register(() => {
    initializations++;
    return () => cleanups++;
  });

  listeners.get("DOMContentLoaded")?.[0]();
  listeners.get("turbo:load")?.[0]();
  assertEquals([initializations, cleanups], [1, 0]);
  assertEquals(document.documentElement.dataset.directoryView, "false");
  document.body = { dataset: { directoryView: "true" } };
  listeners.get("turbo:load")?.[0]();
  assertEquals([initializations, cleanups], [2, 1]);
  assertEquals(document.documentElement.dataset.directoryView, "true");
  listeners.get("turbo:before-cache")?.[0]();
  listeners.get("turbo:load")?.[0]();
  assertEquals([initializations, cleanups], [3, 2]);
});
