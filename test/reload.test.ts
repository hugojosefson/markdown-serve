import { assert, assertEquals, assertMatch } from "@std/assert";
import { join } from "@std/path";
import { serve } from "../src/server.ts";
import { reloadClientScript } from "../src/server/reload-client.ts";
import {
  createReloadWatcher,
  reloadEventRelevant,
} from "../src/server/reload.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("source changes defer browser reload until the server reconnects", () => {
  const listeners = new Map<string, () => void>();
  let reloads = 0;
  class EventSource {
    constructor(_url: string) {}
    addEventListener(name: string, listener: () => void): void {
      listeners.set(name, listener);
    }
  }
  new Function("EventSource", "location", reloadClientScript)(EventSource, {
    reload: () => reloads++,
  });
  listeners.get("open")?.();
  assertEquals(reloads, 0);
  listeners.get("open")?.();
  assertEquals(reloads, 1);
  listeners.get("reload")?.();
  assertEquals(reloads, 2);
});

Deno.test("source paths do not race content reload notifications", () => {
  const root = Deno.cwd();
  const source = join(root, "src");
  const event = (paths: string[]): Deno.FsEvent => ({ kind: "modify", paths });
  assertEquals(
    reloadEventRelevant(event([join(source, "server/page-css.ts")]), [source]),
    false,
  );
  assertEquals(
    reloadEventRelevant(event([join(root, "src-other/page.css")]), [source]),
    true,
  );
  assertEquals(
    reloadEventRelevant(
      event([join(source, "server/page-css.ts"), join(root, "README.md")]),
      [source],
    ),
    false,
  );
});

Deno.test("an ignored source event cancels a pending content reload", async () => {
  const f = await fixture({ "content.txt": "before", "src/code.ts": "before" });
  const watcher = createReloadWatcher(f.root, undefined, [join(f.root, "src")]);
  let reloads = 0;
  const unsubscribe = watcher.subscribe(() => {
    reloads++;
  });
  try {
    await Deno.writeTextFile(join(f.root, "content.txt"), "pending");
    await Deno.writeTextFile(join(f.root, "src/code.ts"), "restart");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assertEquals(reloads, 0);

    await Deno.writeTextFile(join(f.root, "content.txt"), "after restart");
    await new Promise((resolve) => setTimeout(resolve, 150));
    assertEquals(reloads, 1);
  } finally {
    unsubscribe();
    watcher.close();
    await f.cleanup();
  }
});

Deno.test("reload client and SSE are limited to generated pages", async () => {
  const f = await fixture({
    "guide.md": "guide",
    "docs/README.md": "docs",
    "raw.txt": "raw",
  });
  const state = { listener: () => {}, subscriptions: 0 };
  const source = {
    subscribe: (next: () => void) => {
      state.listener = next;
      return () => {};
    },
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    for (const route of ["/guide", "/docs/", "/"]) {
      assertMatch(
        await (await h(new Request(`http://x${route}`))).text(),
        /EventSource/,
      );
    }
    const textResponse = await h(new Request("http://x/raw.txt"));
    assert(textResponse.headers.get("content-type")?.includes("html"));
    assertMatch(await textResponse.text(), /EventSource/);
    const response = await h(
      new Request("http://x/__markdown_server__/events"),
    );
    const reader = response.body!.getReader();
    state.listener();
    const chunk = await reader.read();
    assertMatch(new TextDecoder().decode(chunk.value), /event: reload/);
    await reader.cancel();
    const headHandler = await handler(f.root, {
      reloadSource: {
        subscribe: () => {
          state.subscriptions += 1;
          return () => {};
        },
      },
    });
    const head = await headHandler(
      new Request("http://x/__markdown_server__/events", { method: "HEAD" }),
    );
    assertEquals(
      [head.status, state.subscriptions, await head.text()],
      [200, 1, ""],
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("custom reload sources unsubscribe SSE clients on cancellation and close", async () => {
  const f = await fixture({ "guide.md": "guide" });
  const subscribers = new Set<{ close?: () => void }>();
  const source = {
    subscribe: (_notify: () => void, close?: () => void) => {
      const subscriber = { close };
      subscribers.add(subscriber);
      return () => subscribers.delete(subscriber);
    },
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const cancelled = await h(
      new Request("http://x/__markdown_server__/events"),
    );
    const cancelledReader = cancelled.body!.getReader();
    assertEquals(subscribers.size, 2);
    await cancelledReader.cancel();
    assertEquals(subscribers.size, 1);

    const closed = await h(new Request("http://x/__markdown_server__/events"));
    const closedReader = closed.body!.getReader();
    assertEquals(subscribers.size, 2);
    for (const subscriber of [...subscribers]) {
      subscriber.close?.();
    }
    assertEquals((await closedReader.read()).done, true);
    assertEquals(subscribers.size, 0);
  } finally {
    await f.cleanup();
  }
});

Deno.test("SSE unsubscribes when a reload source closes during subscribe", async () => {
  const f = await fixture({ "guide.md": "guide" });
  let unsubscribes = 0;
  const source = {
    subscribe: (_notify: () => void, close?: () => void) => {
      close?.();
      return () => unsubscribes += 1;
    },
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const response = await h(
      new Request("http://x/__markdown_server__/events"),
    );
    assertEquals((await response.body!.getReader().read()).done, true);
    assertEquals(unsubscribes, 2);
  } finally {
    await f.cleanup();
  }
});

Deno.test("reload notifications invalidate index detection", async () => {
  const f = await fixture({ "docs/file.txt": "plain" });
  let notify = () => {};
  const source = {
    subscribe: (listener: () => void) => (notify = listener, () => {}),
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const url = "http://x/docs/?dir";
    assertEquals((await h(new Request(url))).status, 302);
    await Deno.writeTextFile(`${f.root}/docs/README.md`, "now indexed");
    notify();
    assertEquals((await h(new Request(url))).status, 200);
  } finally {
    await f.cleanup();
  }
});

Deno.test("watched reload warms the catalog before notifying SSE clients", async () => {
  const f = await fixture({ "docs/file.txt": "plain", "guide.md": "guide" });
  const server = await serve({
    root: f.root,
    hostname: "127.0.0.1",
    port: 0,
    liveReload: true,
    onListen: () => {},
  });
  try {
    const address = server.addr as Deno.NetAddr;
    const response = await fetch(
      `http://${address.hostname}:${address.port}/__markdown_server__/events`,
    );
    const reader = response.body!.getReader();
    assertEquals(
      (await fetch(
        `http://${address.hostname}:${address.port}/docs/?dir`,
        { redirect: "manual" },
      )).status,
      302,
    );
    await Deno.writeTextFile(`${f.root}/docs/README.md`, "indexed");
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("reload event timed out")), 2_000)
      ),
    ]);
    assertMatch(new TextDecoder().decode(result.value), /event: reload/);
    assertEquals(
      (await fetch(
        `http://${address.hostname}:${address.port}/docs/?dir`,
        { redirect: "manual" },
      )).status,
      200,
    );
    await reader.cancel();
    await server.shutdown();
    await server.finished;
    assert(true);
  } finally {
    await f.cleanup();
  }
});

Deno.test("watched reload closes SSE on abort", async () => {
  const f = await fixture({ "guide.md": "guide" });
  const abort = new AbortController();
  const server = await serve({
    root: f.root,
    hostname: "127.0.0.1",
    port: 0,
    signal: abort.signal,
    liveReload: true,
    onListen: () => {},
  });
  try {
    const address = server.addr as Deno.NetAddr;
    const response = await fetch(
      `http://${address.hostname}:${address.port}/__markdown_server__/events`,
    );
    const reader = response.body!.getReader();
    abort.abort();
    const result = await reader.read().catch(() => ({ done: true }));
    assertEquals(result.done, true);
    await server.finished;
  } finally {
    await f.cleanup();
  }
});
