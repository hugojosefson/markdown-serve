import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import {
  createFinderRunner,
  parseFinderOutput,
} from "../src/server/file-search.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("scoped file search includes dotfiles and uses canonical file routes", async () => {
  const f = await fixture({
    ".hidden": "x",
    "guide.md": "guide",
    "docs/note.txt": "note",
    "docs/nested/.secret": "secret",
    "..scope/inside.txt": "inside",
  });
  try {
    const h = await handler(f.root);
    const response = await h(
      new Request("http://x/__markdown_serve__/files?path=docs"),
    );
    assertEquals(
      response.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    assertEquals(await response.json(), [
      {
        name: "nested/.secret",
        path: "nested/.secret",
        href: "/docs/nested/.secret",
      },
      { name: "note.txt", path: "note.txt", href: "/docs/note.txt" },
    ]);
    const root = await h(
      new Request("http://x/__markdown_serve__/files?path="),
    );
    assertEquals(await root.json(), [
      {
        name: "..scope/inside.txt",
        path: "..scope/inside.txt",
        href: "/..scope/inside.txt",
      },
      { name: ".hidden", path: ".hidden", href: "/.hidden" },
      {
        name: "docs/nested/.secret",
        path: "docs/nested/.secret",
        href: "/docs/nested/.secret",
      },
      { name: "docs/note.txt", path: "docs/note.txt", href: "/docs/note.txt" },
      { name: "guide.md", path: "guide.md", href: "/guide" },
    ]);
    const dottedScope = await h(
      new Request("http://x/__markdown_serve__/files?path=..scope"),
    );
    assertEquals(await dottedScope.json(), [{
      name: "inside.txt",
      path: "inside.txt",
      href: "/..scope/inside.txt",
    }]);
    const page = await (await h(new Request("http://x/docs/note.txt"))).text();
    assertMatch(page, /data-go-to-file-scope="docs"/);
    assertMatch(
      await (await h(new Request("http://x/guide"))).text(),
      /data-go-to-file-scope=""/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("file search validates scopes and handles HEAD and methods", async () => {
  const f = await fixture({ "safe.txt": "safe" });
  try {
    const h = await handler(f.root);
    assertEquals(
      (await h(new Request("http://x/__markdown_serve__/files?path=..")))
        .status,
      400,
    );
    const head = await h(
      new Request("http://x/__markdown_serve__/files?path=", {
        method: "HEAD",
      }),
    );
    assertEquals([head.status, await head.text()], [200, ""]);
    const post = await h(
      new Request("http://x/__markdown_serve__/files?path=", {
        method: "POST",
      }),
    );
    assertEquals([post.status, post.headers.get("allow")], [405, "GET, HEAD"]);
  } finally {
    await f.cleanup();
  }
});

Deno.test("file search caps results, escapes special names, and tolerates removed scopes", async () => {
  const f = await fixture({
    ...Object.fromEntries(
      Array.from({ length: 205 }, (_, index) => [`many/${index}.txt`, "x"]),
    ),
    "nested/space #?.md": "special",
    "vanished/file.txt": "gone",
  });
  try {
    const h = await handler(f.root);
    const many = await h(
      new Request("http://x/__markdown_serve__/files?path=many"),
    );
    assertEquals((await many.json()).length, 200);
    const nested = await h(
      new Request("http://x/__markdown_serve__/files?path=nested"),
    );
    assertEquals(await nested.json(), [{
      name: "space #?.md",
      path: "space #?.md",
      href: "/nested/space%20%23%3F",
    }]);
    await Deno.remove(`${f.root}/vanished`, { recursive: true });
    const vanished = await h(
      new Request("http://x/__markdown_serve__/files?path=vanished"),
    );
    assertEquals(await vanished.json(), []);
  } finally {
    await f.cleanup();
  }
});

Deno.test("finder output normalizes Windows paths and finder failure falls back", async () => {
  assertEquals(
    parseFinderOutput(new TextEncoder().encode(".\\dir\\guide.md\0")),
    ["dir/guide.md"],
  );
  const f = await fixture({ "fallback.txt": "x" });
  try {
    const h = await handler(f.root, {
      finders: ["fd", "fdfind"],
      finderRunner: () => Promise.reject(new Error("broken finder")),
    });
    const response = await h(
      new Request("http://x/__markdown_serve__/files?path="),
    );
    assertEquals(await response.json(), [{
      name: "fallback.txt",
      path: "fallback.txt",
      href: "/fallback.txt",
    }]);
  } finally {
    await f.cleanup();
  }
});

Deno.test("finder caps streamed output and times out without a binary", async () => {
  const stream = (text: string, open = false) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        if (text) controller.enqueue(new TextEncoder().encode(text));
        if (!open) controller.close();
      },
    });
  const child = (stdout: ReadableStream<Uint8Array>) => {
    let settle!: () => void;
    const signals: Deno.Signal[] = [];
    return {
      stdout,
      status: new Promise<Deno.CommandStatus>((resolve) => {
        settle = () =>
          resolve({ success: false, code: 137, signal: "SIGKILL" });
      }),
      kill(signal: Deno.Signal = "SIGTERM") {
        signals.push(signal);
        if (signal === "SIGKILL") settle();
      },
      signals,
    };
  };
  const excessive = child(stream("x".repeat(21)));
  await assertRejects(
    () =>
      createFinderRunner(() => excessive, {
        timeoutMilliseconds: 100,
        outputBytes: 20,
      })("fd", "."),
  );
  assertEquals(excessive.signals, ["SIGTERM", "SIGKILL"]);
  const timeout = child(stream("", true));
  await assertRejects(
    () =>
      createFinderRunner(() => timeout, {
        timeoutMilliseconds: 1,
        outputBytes: 20,
      })("fd", "."),
  );
  assertEquals(timeout.signals, ["SIGTERM", "SIGKILL"]);
});
