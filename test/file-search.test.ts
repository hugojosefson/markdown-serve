import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import {
  createFinderRunner,
  parseFinderOutput,
  subsequenceMatch,
} from "../src/server/file-search.ts";
import { runGit } from "../src/server/git/command.ts";
import { fixture, handler } from "./fixture.ts";

async function git(root: string, args: string[]): Promise<void> {
  const result = await runGit(root, args);
  if (!result.success) throw new Error(result.stderr);
}

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
      name: "docs/note.txt",
      path: "docs/note.txt",
      href: "/docs/note.txt",
    }, {
      name: "docs/nested/.secret",
      path: "docs/nested/.secret",
      href: "/docs/nested/.secret",
    }]);
    const root = await h(
      new Request("http://x/__markdown_serve__/files?search="),
    );
    const values = await root.json();
    const paths = values.map((value: { path: string }) => value.path);
    const firstHidden = paths.findIndex((path: string) =>
      path.split("/").some((part) => part.startsWith("."))
    );
    assertEquals(
      paths.slice(firstHidden).every((path: string) =>
        path.split("/").some((part) => part.startsWith("."))
      ),
      true,
    );
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

Deno.test("fallback ranking applies before the result cap", async () => {
  const f = await fixture({
    ...Object.fromEntries(
      Array.from({ length: 205 }, (_, index) => [
        `.hidden-rank-${index}.txt`,
        "hidden",
      ]),
    ),
    "visible-rank.txt": "visible",
  });
  try {
    const h = await handler(f.root);
    const results = await (await h(
      new Request("http://x/__markdown_serve__/files?search=rank"),
    )).json();
    assertEquals([results.length, results[0].path], [200, "visible-rank.txt"]);
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

Deno.test("file search ranks Git and visibility before applying its cap", async () => {
  const ignored = Object.fromEntries(
    Array.from({ length: 205 }, (_, index) => [
      `ignored/cap-${index}.txt`,
      "ignored",
    ]),
  );
  const f = await fixture({
    ".gitignore": "ignored/\n",
    "visible-order.txt": "tracked",
    ".hidden-order.txt": "tracked",
    "ignored/visible-order.txt": "ignored",
    "ignored/.hidden-order.txt": "ignored",
    "tracked-cap.txt": "tracked",
    ...ignored,
  });
  try {
    await git(f.root, ["init", "--initial-branch=main"]);
    await git(f.root, ["add", "."]);
    await git(f.root, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "initial commit",
    ]);
    const h = await handler(f.root, {
      git: true,
      finders: ["fd"],
      finderRunner: (_finders, _root, query) =>
        Promise.resolve(
          query === "order"
            ? [
              "ignored/.hidden-order.txt",
              "ignored/visible-order.txt",
              ".hidden-order.txt",
              "visible-order.txt",
            ]
            : [
              ...Object.keys(ignored),
              "tracked-cap.txt",
            ],
        ),
    });
    const ordered = await (await h(
      new Request("http://x/__markdown_serve__/files?search=order"),
    )).json();
    assertEquals(
      ordered.map((result: { path: string }) => result.path),
      [
        "visible-order.txt",
        ".hidden-order.txt",
        "ignored/visible-order.txt",
        "ignored/.hidden-order.txt",
      ],
    );
    const capped = await (await h(
      new Request("http://x/__markdown_serve__/files?search=cap"),
    )).json();
    assertEquals([capped.length, capped[0].path], [200, "tracked-cap.txt"]);
  } finally {
    await f.cleanup();
  }
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
