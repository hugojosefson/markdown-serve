import { assert, assertEquals, assertMatch } from "@std/assert";
import { join } from "@std/path";
import { serve } from "../src/server.ts";
import { reloadClientScript } from "../src/server/reload-client.ts";
import {
  createReloadWatcher,
  reloadEventRelevant,
  ReloadHub,
} from "../src/server/reload.ts";
import { fileRevision } from "../src/server/active-file-poller.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("source changes close reload events before reloading the page", () => {
  const listeners = new Map<string, () => void>();
  let reloads = 0;
  let closes = 0;
  class EventSource {
    constructor(_url: string) {}
    addEventListener(name: string, listener: () => void): void {
      listeners.set(name, listener);
    }
    close(): void {
      closes++;
    }
  }
  const globalThis = {
    addEventListener: () => {},
    navigation: { addEventListener: () => {} },
  };
  const document = { addEventListener: () => {} };
  new Function(
    "EventSource",
    "location",
    "document",
    "globalThis",
    reloadClientScript,
  )(
    EventSource,
    { href: "http://x/", reload: () => reloads++ },
    document,
    globalThis,
  );
  listeners.get("open")?.();
  assertEquals(reloads, 0);
  listeners.get("open")?.();
  assertEquals([reloads, closes], [1, 1]);
  listeners.get("reload")?.();
  assertEquals([reloads, closes], [1, 1]);
});

Deno.test("reload client notifies an edit page without discarding its draft", () => {
  const sourceListeners = new Map<string, () => void>();
  let notifications = 0;
  let reloads = 0;
  const editor = {};
  class EventSource {
    constructor(_url: string) {}
    addEventListener(name: string, listener: () => void): void {
      sourceListeners.set(name, listener);
    }
    close(): void {}
  }
  const document = {
    querySelector: (selector?: string) =>
      selector === ".edit-page" ? editor : undefined,
    addEventListener: () => {},
    dispatchEvent: () => {
      notifications++;
      return true;
    },
  };
  new Function(
    "EventSource",
    "location",
    "document",
    "globalThis",
    reloadClientScript,
  )(
    EventSource,
    { href: "http://x/", reload: () => reloads++ },
    document,
    { addEventListener: () => {} },
  );
  sourceListeners.get("reload")?.();
  sourceListeners.get("reload")?.();
  assertEquals([notifications, reloads], [2, 0]);
});

Deno.test("reload client releases navigation connections and reconnects after restoration", () => {
  type Listener = (event: Record<string, unknown>) => void;
  const pageListeners = new Map<string, Listener>();
  const documentListeners = new Map<string, Listener>();
  const navigationListeners = new Map<string, Listener>();
  const sources: Array<{
    closed: boolean;
    listeners: Map<string, () => void>;
  }> = [];
  let reloads = 0;
  class EventSource {
    readonly state = {
      closed: false,
      listeners: new Map<string, () => void>(),
    };
    constructor(_url: string) {
      sources.push(this.state);
    }
    addEventListener(name: string, listener: () => void): void {
      this.state.listeners.set(name, listener);
    }
    close(): void {
      this.state.closed = true;
    }
  }
  const globalThis = {
    addEventListener: (name: string, listener: Listener) =>
      pageListeners.set(name, listener),
    navigation: {
      addEventListener: (name: string, listener: Listener) =>
        navigationListeners.set(name, listener),
    },
  };
  const document = {
    addEventListener: (name: string, listener: Listener) =>
      documentListeners.set(name, listener),
  };
  new Function(
    "EventSource",
    "location",
    "document",
    "globalThis",
    reloadClientScript,
  )(
    EventSource,
    { href: "http://x/readme/", reload: () => reloads++ },
    document,
    globalThis,
  );

  documentListeners.get("click")?.({
    button: 0,
    target: {
      closest: () => ({
        href: "http://x/readme/?metadata",
        matches: () => false,
        target: "",
      }),
    },
  });
  assertEquals(sources[0].closed, true);

  pageListeners.get("pageshow")?.({ persisted: false });
  assertEquals(sources.length, 1);
  pageListeners.get("pageshow")?.({ persisted: true });
  assertEquals(sources.length, 2);
  sources[0].listeners.get("open")?.();
  assertEquals(reloads, 0);
  sources[1].listeners.get("open")?.();
  assertEquals(reloads, 0);
  navigationListeners.get("navigate")?.({
    hashChange: false,
    downloadRequest: null,
  });
  assertEquals(sources[1].closed, true);
});

Deno.test("reload client identifies its rendered file to SSE", () => {
  const urls: string[] = [];
  class EventSource {
    constructor(url: string) {
      urls.push(url);
    }
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
    { href: "http://x/guide" },
    {
      body: {
        dataset: { reloadPath: "guide.md", reloadRevision: "1,2,3,4,5" },
      },
      addEventListener: () => {},
    },
    { addEventListener: () => {} },
  );
  assertEquals(urls, [
    "/__markdown_serve__/events?path=guide.md&revision=1%2C2%2C3%2C4%2C5",
  ]);
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

Deno.test("live reload starts despite inaccessible descendants", async () => {
  const f = await fixture({
    "visible.txt": "visible",
    "blocked/hidden.txt": "hidden",
  });
  const blocked = join(f.root, "blocked");
  const warnings: string[] = [];
  try {
    await Deno.chmod(blocked, 0o000);
    try {
      for await (const _entry of Deno.readDir(blocked)) break;
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        const server = await serve({
          root: f.root,
          hostname: "127.0.0.1",
          port: 0,
          liveReload: true,
          warn: (warning) => warnings.push(warning),
          onListen: () => {},
        });
        try {
          const address = server.addr as Deno.NetAddr;
          assertEquals(
            (await fetch(
              `http://${address.hostname}:${address.port}/visible.txt`,
            )).status,
            200,
          );
          assertEquals(warnings, ["Cannot access blocked: permission denied"]);
        } finally {
          await server.shutdown();
          await server.finished;
        }
      }
    }
  } finally {
    await Deno.chmod(blocked, 0o755);
    await f.cleanup();
  }
});

Deno.test("watcher failures preserve subscribers until the hub closes", async () => {
  const closed = Promise.withResolvers<void>();
  let closes = 0;
  const watcher = {
    close: () => {
      closes++;
      closed.resolve();
    },
    [Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent> {
      return { next: () => Promise.reject(new Error("watch failed")) };
    },
  } as unknown as Deno.FsWatcher;
  const hub = new ReloadHub(watcher, undefined, [], 10);
  let subscriberCloses = 0;
  hub.subscribe(() => {}, () => subscriberCloses++);

  await closed.promise;
  assertEquals(subscriberCloses, 0);
  hub.close();

  assertEquals([closes, subscriberCloses], [1, 1]);
});

Deno.test("watcher setup exhaustion falls back to active file polling", async () => {
  const f = await fixture({ "guide.md": "before" });
  const file = join(f.root, "guide.md");
  const hub = createReloadWatcher(
    f.root,
    undefined,
    [],
    () => {
      throw new Error("inotify exhausted");
    },
    10,
  );
  let reloads = 0;
  const unsubscribe = hub.subscribe(() => {
    reloads++;
  });
  const untrack = hub.trackViewedFile!(
    file,
    fileRevision(await Deno.stat(file)),
  );
  try {
    await Deno.writeTextFile(file, "after replacement");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(reloads, 1);
  } finally {
    untrack();
    unsubscribe();
    hub.close();
    await f.cleanup();
  }
});

Deno.test("watcher failure retains subscribers and polls their active files", async () => {
  const f = await fixture({ "guide.md": "before" });
  const file = join(f.root, "guide.md");
  const watcher = {
    close: () => {},
    [Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent> {
      return { next: () => Promise.reject(new Error("watch failed")) };
    },
  } as unknown as Deno.FsWatcher;
  const hub = new ReloadHub(watcher, undefined, [], 10);
  let reloads = 0;
  const unsubscribe = hub.subscribe(() => {
    reloads++;
  });
  const untrack = hub.trackViewedFile(
    file,
    fileRevision(await Deno.stat(file)),
  );
  try {
    await Deno.writeTextFile(file, "after replacement");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(reloads, 1);
  } finally {
    untrack();
    unsubscribe();
    hub.close();
    await f.cleanup();
  }
});

Deno.test("an ignored source event cancels a pending content reload", async () => {
  const root = Deno.cwd();
  const source = join(root, "src");
  const events = new TransformStream<Deno.FsEvent>();
  const writer = events.writable.getWriter();
  const watcher = {
    close: () => {
      void writer.close();
    },
    [Symbol.asyncIterator](): AsyncIterator<Deno.FsEvent> {
      return events.readable[Symbol.asyncIterator]();
    },
  } as unknown as Deno.FsWatcher;
  const emit = (path: string) =>
    writer.write({ kind: "modify", paths: [path] });
  const hub = new ReloadHub(watcher, undefined, [source]);
  let reloads = 0;
  hub.subscribe(() => {
    reloads++;
  });
  try {
    await emit(join(root, "content.txt"));
    await emit(join(source, "code.ts"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(reloads, 0);

    await emit(join(root, "content.txt"));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assertEquals(reloads, 1);
  } finally {
    hub.close();
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
      new Request("http://x/__markdown_serve__/events"),
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
      new Request("http://x/__markdown_serve__/events", { method: "HEAD" }),
    );
    assertEquals(
      [head.status, state.subscriptions, await head.text()],
      [200, 1, ""],
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("generated file pages identify active files but directory listings do not", async () => {
  const f = await fixture({
    "guide.md": "guide",
    "notes.txt": "notes",
    "image.png": "image",
    "docs/README.md": "docs",
  });
  const source = { subscribe: () => () => {} };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const guide = await (await h(new Request("http://x/guide"))).text();
    const notes = await (await h(new Request("http://x/notes.txt"))).text();
    const image = await (await h(new Request("http://x/image.png"))).text();
    const indexed = await (await h(new Request("http://x/docs/"))).text();
    const listing = await (await h(new Request("http://x/docs/?dir"))).text();
    assertMatch(guide, /data-reload-path="guide.md"/);
    assertMatch(notes, /data-reload-path="notes.txt"/);
    assertMatch(image, /data-reload-path="image.png"/);
    assertMatch(indexed, /data-reload-path="docs\/README.md"/);
    assert(!listing.includes("data-reload-path="));
  } finally {
    await f.cleanup();
  }
});

Deno.test("SSE validates paths and releases active-file tracking on cancellation", async () => {
  const f = await fixture({ "guide.md": "guide" });
  const tracked = new Set<string>();
  const source = {
    subscribe: () => () => {},
    trackViewedFile: (path: string) => {
      tracked.add(path);
      return () => tracked.delete(path);
    },
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const invalid = await h(
      new Request(
        "http://x/__markdown_serve__/events?path=../secret&revision=1,2,3,4,5",
      ),
    );
    assertEquals(invalid.status, 400);
    assertEquals(tracked.size, 0);

    const response = await h(
      new Request(
        "http://x/__markdown_serve__/events?path=guide.md&revision=1,2,3,4,5",
      ),
    );
    const reader = response.body!.getReader();
    assertEquals(tracked.size, 1);
    await reader.cancel();
    assertEquals(tracked.size, 0);
  } finally {
    await f.cleanup();
  }
});

Deno.test("SSE releases subscriptions when active-file tracking fails", async () => {
  const f = await fixture({ "guide.md": "guide" });
  const subscriptions = new Set<number>();
  let next = 0;
  const source = {
    subscribe: () => {
      const id = next++;
      subscriptions.add(id);
      return () => subscriptions.delete(id);
    },
    trackViewedFile: () => {
      throw new Error("tracking failed");
    },
  };
  try {
    const h = await handler(f.root, { reloadSource: source });
    const response = await h(
      new Request(
        "http://x/__markdown_serve__/events?path=guide.md&revision=1,2,3,4,5",
      ),
    );
    await response.body!.getReader().read().catch(() => ({ done: true }));
    assertEquals(subscriptions.size, 1);
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
      new Request("http://x/__markdown_serve__/events"),
    );
    const cancelledReader = cancelled.body!.getReader();
    assertEquals(subscribers.size, 2);
    await cancelledReader.cancel();
    assertEquals(subscribers.size, 1);

    const closed = await h(
      new Request("http://x/__markdown_serve__/events"),
    );
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
      new Request("http://x/__markdown_serve__/events"),
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
      `http://${address.hostname}:${address.port}/__markdown_serve__/events`,
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
      `http://${address.hostname}:${address.port}/__markdown_serve__/events`,
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
