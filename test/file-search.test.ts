import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import {
  createFinderRunner,
  parseFinderOutput,
  subsequenceMatch,
} from "../src/server/file-search.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("root-wide file search matches full paths, directories, and canonical routes", async () => {
  const f = await fixture({
    ".hidden": "x",
    "guide.md": "guide",
    "docs/note.txt": "note",
    "docs/nested/.secret": "secret",
    ".git/config": "excluded",
  });
  try {
    const h = await handler(f.root);
    const response = await h(
      new Request("http://x/__markdown_serve__/files?search=nt"),
    );
    assertEquals(await response.json(), [{
      name: "docs/nested/",
      path: "docs/nested/",
      href: "/docs/nested/",
    }, {
      name: "docs/nested/.secret",
      path: "docs/nested/.secret",
      href: "/docs/nested/.secret",
    }, {
      name: "docs/note.txt",
      path: "docs/note.txt",
      href: "/docs/note.txt",
    }]);
    const root = await h(
      new Request("http://x/__markdown_serve__/files?search="),
    );
    const values = await root.json();
    assertEquals(
      values.some((value: { path: string; href: string }) =>
        value.path === "docs/" && value.href === "/docs/"
      ),
      true,
    );
    assertEquals(
      values.some((value: { path: string }) => value.path.startsWith(".git")),
      false,
    );
    assertMatch(
      await (await h(new Request("http://x/docs/note.txt"))).text(),
      /data-go-to-file-prefix="docs\/"/,
    );
    assertMatch(
      await (await h(new Request("http://x/guide"))).text(),
      /data-go-to-file-prefix=""/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("file search validates query length and caps after filtering", async () => {
  const f = await fixture(
    Object.fromEntries(
      Array.from({ length: 205 }, (_, i) => [`many/${i}.txt`, "x"]),
    ),
  );
  try {
    const h = await handler(f.root);
    assertEquals(
      (await h(
        new Request(
          `http://x/__markdown_serve__/files?search=${"😀".repeat(257)}`,
        ),
      )).status,
      400,
    );
    assertEquals(
      (await (await h(
        new Request("http://x/__markdown_serve__/files?search=.txt"),
      )).json()).length,
      200,
    );
    assertEquals(
      (await h(
        new Request("http://x/__markdown_serve__/files?search=", {
          method: "HEAD",
        }),
      )).status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("subsequence matching is deterministic and case insensitive", () => {
  assertEquals([
    subsequenceMatch("docs/Note.TXT", "dnt"),
    subsequenceMatch("docs/Note.TXT", "td"),
  ], [true, false]);
  assertEquals(
    parseFinderOutput(
      new TextEncoder().encode(".\\dir\\guide.md\0.\\dir\\nested\\\0"),
    ),
    ["dir/guide.md", "dir/nested/"],
  );
});

Deno.test("finder results stay root-scoped and continue after non-matches", async () => {
  const f = await fixture({
    "docs/match.txt": "match",
    "docs/nested/value.txt": "value",
  });
  try {
    let received = "";
    const h = await handler(f.root, {
      finders: ["fd"],
      finderRunner: (_finders, _root, query) => {
        received = query;
        return Promise.resolve([
          "outside.txt",
          "../escape.txt",
          "docs/match.txt",
          "docs/nested",
        ]);
      },
    });
    const response = await h(
      new Request("http://x/__markdown_serve__/files?search=dmt"),
    );
    assertEquals(received, "dmt");
    assertEquals(await response.json(), [{
      name: "docs/match.txt",
      path: "docs/match.txt",
      href: "/docs/match.txt",
    }]);
  } finally {
    await f.cleanup();
  }
});

Deno.test("finder failure falls back to root traversal", async () => {
  const f = await fixture({ "fallback.txt": "x" });
  try {
    const h = await handler(f.root, {
      finders: ["fd", "fdfind"],
      finderRunner: () => Promise.reject(new Error("broken finder")),
    });
    const response = await h(
      new Request("http://x/__markdown_serve__/files?search=fbt"),
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

Deno.test("finder runner preserves output and timeout bounds", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(21)));
      controller.close();
    },
  });
  let settle!: () => void;
  const child = {
    stdout: stream,
    status: new Promise<Deno.CommandStatus>((resolve) =>
      settle = () => resolve({ success: false, code: 137, signal: "SIGKILL" })
    ),
    kill(signal?: Deno.Signal) {
      if (signal === "SIGKILL") settle();
    },
  };
  await assertRejects(() =>
    createFinderRunner(() => child, {
      timeoutMilliseconds: 100,
      outputBytes: 20,
    })("fd", ".", "")
  );
});
