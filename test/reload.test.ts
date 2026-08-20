import { assert, assertEquals, assertMatch } from "@std/assert";
import { serve } from "../src/server.ts";
import { fixture, handler } from "./fixture.ts";

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

Deno.test("reload notifications invalidate the session file catalog", async () => {
  const f = await fixture({ "docs/file.txt": "plain" });
  let notify = () => {};
  const source = {
    subscribe: (listener: () => void) => (notify = listener, () => {}),
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const url = "http://x/__markdown_server__/index?path=docs";
    assertEquals(await (await h(new Request(url))).json(), {});
    await Deno.writeTextFile(`${f.root}/docs/README.md`, "now indexed");
    notify();
    assertEquals(await (await h(new Request(url))).json(), {
      filesHref: "/docs/?dir",
    });
  } finally {
    await f.cleanup();
  }
});

Deno.test("watched reload emits SSE and closes on shutdown", async () => {
  const f = await fixture({ "guide.md": "guide" });
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
    await Deno.writeTextFile(`${f.root}/changed.txt`, "changed");
    const result = await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("reload event timed out")), 2_000)
      ),
    ]);
    assertMatch(new TextDecoder().decode(result.value), /event: reload/);
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
