import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import { parseArgs } from "../src/cli/parse-args.ts";
import { assertServePermissions } from "../src/cli/capabilities.ts";
import {
  atomicReplace,
  EditConflict,
  type EditFileSystem,
  editLimit,
} from "../src/server/edit-response.ts";
import { editCss } from "../src/server/edit-css.ts";
import { pageCss } from "../src/server/page-css.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("editor overlay keeps syntax tokens on textarea metrics", () => {
  assertMatch(editCss, /font-variant-ligatures: none/);
  assertMatch(editCss, /\.edit-highlight\.code-block \.token \{ font: inherit/);
  assertMatch(
    editCss,
    /\.edit-highlight, \.edit-highlight\.code-block \{[^}]*color: var\(--code-text\)/,
  );
  assertMatch(
    editCss,
    /\.edit-highlight\.code-block > code[^}]*font-size: var\(--edit-font-size\)/,
  );
  assertMatch(
    editCss,
    /\.edit-highlight\.code-block \{ padding: 12px 12px 12px 28px; \}/,
  );
  assertEquals(
    /\.token\.(?:title|bold)[^{]*\{[^}]*font-weight/.test(editCss),
    false,
  );
  assertMatch(pageCss, /\.layout > \.content \{ min-width: 0; padding:/);
  assertEquals(/\n\.content \{ min-width: 0; padding:/.test(pageCss), false);
});

Deno.test("Markdown layout styles default to a full-width editor and bound split panes", () => {
  assertMatch(
    editCss,
    /\[data-edit-layout="editor"\] \.edit-markdown-preview \{ display: none;/,
  );
  assertMatch(
    editCss,
    /\[data-edit-layout="split-horizontal"\] \{ grid-template-rows:/,
  );
  assertMatch(
    editCss,
    /\[data-edit-layout="split-vertical"\] \{ grid-template-columns:/,
  );
  assertMatch(
    editCss,
    /split-vertical"\] \.edit-text \{ height: 100%; min-height: 0; resize: none;/,
  );
  assertMatch(editCss, /::highlight\(edit-preview-caret\)/);
  assertMatch(editCss, /::highlight\(edit-preview-selection\)/);
});

Deno.test("editing is opt-in and requires a root-scoped write grant", () => {
  assertEquals(parseArgs([]).edit, false);
  assertEquals(parseArgs(["--edit"]).edit, true);
  const query = (descriptor: Deno.PermissionDescriptor) =>
    ({
      state: descriptor.name === "write" ? "denied" : "granted",
    }) as Pick<Deno.PermissionStatus, "state">;
  try {
    assertServePermissions(
      ".",
      "localhost",
      8000,
      false,
      query,
      () => {},
      true,
    );
    throw new Error("expected write denial");
  } catch (error) {
    assertMatch(String(error), /grant --allow-write=/);
  }
});

Deno.test({
  name:
    "programmatic editing requires write permission but read-only serving does not",
  permissions: { read: true, write: false, run: false },
  async fn() {
    await handler(Deno.cwd(), { git: false });
    await assertRejects(
      () => handler(Deno.cwd(), { edit: true, git: false }),
      Error,
      `grant --allow-write=${Deno.cwd()}`,
    );
  },
});

Deno.test("edit endpoint supplies read headers and rejects unsafe writes", async () => {
  const f = await fixture({ "note.txt": "first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const get = await on(new Request(url));
    assertEquals(
      [
        get.status,
        get.headers.get("content-type"),
        get.headers.get("content-length"),
        await get.text(),
      ],
      [200, "text/plain; charset=UTF-8", "6", "first\n"],
    );
    const head = await on(new Request(url, { method: "HEAD" }));
    assertEquals([
      head.status,
      await head.text(),
      head.headers.get("etag") === null,
    ], [200, "", false]);
    const unsafeHeaders: [Record<string, string>, number][] = [
      [{}, 403],
      [{
        Origin: "http://elsewhere",
        "If-Match": '"x"',
        "Content-Type": "text/plain; charset=UTF-8",
      }, 403],
      [
        { Origin: "http://x", "Content-Type": "text/plain; charset=UTF-8" },
        428,
      ],
      [{
        Origin: "http://x",
        "If-Match": '"x"',
        "Content-Type": "application/json",
      }, 415],
      [{
        Origin: "http://x",
        "If-Match": '"x"',
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Length": "bad",
      }, 413],
    ];
    for (const [headers, status] of unsafeHeaders) {
      const result = await on(
        new Request(url, { method: "PUT", headers, body: "x" }),
      );
      assertEquals(result.status, status);
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("Markdown edit page saves through an ordinary versioned form", async () => {
  const f = await fixture({ "guide.md": "# first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const page = await (await on(new Request("http://x/guide?edit"))).text();
    assertMatch(
      page,
      /Rendered<\/a><a[^>]*>Source<\/a><a class="is-selected"[^>]*>Edit<\/a>/,
    );
    assertMatch(page, /<textarea[^>]*># first\n<\/textarea>/);
    assertMatch(
      page,
      /class="token title important"|class="token punctuation"/,
    );
    assertMatch(
      page,
      /class="edit-markdown-preview"[\s\S]*<h1[^>]*>[\s\S]*first<\/h1>/,
    );
    assertMatch(
      page,
      /aria-label="Editor layout"[\s\S]*href="\?edit"[\s\S]*href="\?edit=preview-stacked"[\s\S]*href="\?edit=preview-side-by-side"[\s\S]*href="\?edit=preview"/,
    );
    assertMatch(page, /aria-label="Write only"/);
    assertMatch(page, /aria-label="Stacked editor and preview"/);
    assertMatch(page, /aria-label="Editor and preview side by side"/);
    assertMatch(page, /aria-label="Preview only"/);
    assertMatch(
      page,
      /class="edit-workspace is-markdown" data-edit-layout="editor"/,
    );
    assertEquals(page.includes('<div class="page-content'), false);
    const tag = page.match(/name="etag" value="([^"]+)"/)?.[1].replaceAll(
      "&quot;",
      '"',
    );
    assertEquals(Boolean(tag), true);
    const form = new URLSearchParams({ etag: tag!, content: "# second\n" });
    const saved = await on(
      new Request("http://x/guide?edit", {
        method: "POST",
        headers: {
          Origin: "http://x",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      }),
    );
    assertEquals([saved.status, saved.headers.get("location")], [
      303,
      "?edit&saved",
    ]);
    assertEquals(await Deno.readTextFile(`${f.root}/guide.md`), "# second\n");
    const stale = await on(
      new Request("http://x/guide?edit", {
        method: "POST",
        headers: {
          Origin: "http://x",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ etag: tag!, content: "lost" }),
      }),
    );
    assertEquals(stale.status, 409);
    const conflict = await stale.text();
    assertMatch(conflict, /Conflict: merge the current version/);
    assertMatch(conflict, /<textarea[^>]*>lost<\/textarea>/);
    assertMatch(conflict, /Current file on disk[\s\S]*# second/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("Markdown edit query modes server-render the selected workspace", async () => {
  const f = await fixture({ "guide.md": "# first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    for (
      const [query, layout] of [
        ["?edit", "editor"],
        ["?edit=preview-stacked", "split-horizontal"],
        ["?edit=preview-side-by-side", "split-vertical"],
        ["?edit=preview", "preview"],
      ]
    ) {
      const page = await (await on(new Request(`http://x/guide${query}`)))
        .text();
      assertMatch(page, new RegExp(`data-edit-layout="${layout}"`));
      assertMatch(
        page,
        new RegExp(`data-edit-layout="${layout}" class="is-selected"`),
      );
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("native Markdown layout links retain display queries", async () => {
  const f = await fixture({ "guide.md": "# first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const page = await (await on(
      new Request("http://x/guide?edit=preview&theme=dark&wide"),
    )).text();
    assertMatch(page, /href="\?edit&amp;theme=dark&amp;wide"/);
    assertMatch(
      page,
      /href="\?edit=preview-side-by-side&amp;theme=dark&amp;wide"/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit pages render Markdown and source syntax distinctly", async () => {
  const f = await fixture({
    "styled.md":
      "# Heading\n\n**bold** [devices.md](devices.md) and `inline code`\n",
    "data.json": '{"name": true, "count": 2}\n',
    "code.ts": "const answer: number = 42;\n",
  });
  try {
    const on = await handler(f.root, { edit: true });
    const markdown = await (
      await on(new Request("http://x/styled?edit"))
    ).text();
    assertMatch(markdown, /edit-heading-1/);
    assertMatch(markdown, /token bold/);
    assertMatch(markdown, /token url/);
    assertMatch(
      markdown,
      /class="token url">\[<span class="token content">devices\.md<\/span>\]\(<span class="token url">devices\.md<\/span>\)<\/span>/,
    );
    assertMatch(markdown, /token code-snippet/);
    assertMatch(
      markdown,
      /edit-markdown-preview[\s\S]*<h1[^>]*>[\s\S]*Heading<\/h1>/,
    );
    assertMatch(markdown, /<strong>bold<\/strong>/);
    assertMatch(
      markdown,
      /<a href="http:\/\/x\/devices\.md"[^>]*>devices\.md<\/a>/,
    );
    assertMatch(markdown, /<code>inline code<\/code>/);

    const json = await (
      await on(new Request("http://x/data.json?edit"))
    ).text();
    assertMatch(json, /token property/);
    assertMatch(json, /token boolean/);
    assertMatch(json, /token number/);
    assertEquals(json.includes("edit-markdown-preview"), false);
    assertEquals(json.includes("edit-layout-controls"), false);

    const typescript = await (
      await on(new Request("http://x/code.ts?edit"))
    ).text();
    assertMatch(typescript, /token keyword/);
    assertMatch(typescript, /token builtin|token number/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit merge endpoint combines disk changes without writing", async () => {
  const f = await fixture({ "note.txt": "one\ntwo\nthree\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const page = await (
      await on(new Request("http://x/note.txt?edit"))
    ).text();
    const tag = pageTag(page);
    await Deno.writeTextFile(`${f.root}/note.txt`, "one\ntwo\nTHREE\n");
    const forbidden = await on(
      new Request("http://x/__markdown_serve__/merge?path=note.txt", {
        method: "POST",
        headers: {
          Origin: "http://elsewhere",
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({ base: "", draft: "", tag }),
      }),
    );
    assertEquals(forbidden.status, 403);
    const response = await on(
      new Request("http://x/__markdown_serve__/merge?path=note.txt", {
        method: "POST",
        headers: {
          Origin: "http://x",
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          base: "one\ntwo\nthree\n",
          draft: "ONE\ntwo\nthree\n",
          tag,
        }),
      }),
    );
    assertEquals(response.status, 200);
    const merged = await response.json();
    assertEquals(
      [merged.changed, merged.conflicted, merged.draft, merged.base],
      [true, false, "ONE\ntwo\nTHREE\n", "one\ntwo\nTHREE\n"],
    );
    assertMatch(merged.tag, /^"[0-9a-f]{64}"$/);
    assertEquals(
      await Deno.readTextFile(`${f.root}/note.txt`),
      "one\ntwo\nTHREE\n",
    );
    const abort = new AbortController();
    abort.abort();
    const aborted = await on(
      new Request("http://x/__markdown_serve__/merge?path=note.txt", {
        method: "POST",
        signal: abort.signal,
        headers: {
          Origin: "http://x",
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          base: merged.base,
          draft: merged.draft,
          tag: merged.tag,
        }),
      }),
    );
    assertEquals(aborted.status, 499);
  } finally {
    await f.cleanup();
  }
});

Deno.test("native edit forms are bounded, strict, and same-origin", async () => {
  const f = await fixture({ "guide.md": "original\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const tag = pageTag(
      await (await on(new Request("http://x/guide?edit"))).text(),
    );
    const request = (body: BodyInit, origin = "http://x") =>
      on(
        new Request("http://x/guide?edit", {
          method: "POST",
          headers: {
            ...(origin ? { Origin: origin } : {}),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        }),
      );
    assertEquals(
      (await request(new URLSearchParams({ etag: tag, content: "x" }), ""))
        .status,
      403,
    );
    assertEquals(
      (await request(
        new URLSearchParams({ etag: tag, content: "x" }),
        "http://evil",
      ))
        .status,
      403,
    );
    for (
      const body of [
        `etag=${encodeURIComponent(tag)}&content=%ZZ`,
        `etag=${encodeURIComponent(tag)}&etag=${
          encodeURIComponent(tag)
        }&content=x`,
        `etag=${encodeURIComponent(tag)}&content=x&extra=y`,
        "etag=bad&content=x",
      ]
    ) {
      assertEquals((await request(body)).status, 400);
    }
    const oversized = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("x".repeat(editLimit * 3 + 1025)),
        );
        controller.close();
      },
    });
    assertEquals((await request(oversized)).status, 413);
    assertEquals(await Deno.readTextFile(`${f.root}/guide.md`), "original\n");
  } finally {
    await f.cleanup();
  }
});

Deno.test("native edit forms preserve file line-ending and BOM policy", async () => {
  const f = await fixture({ "guide.md": "one\ntwo\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const save = async (content: string) => {
      const tag = pageTag(
        await (await on(new Request("http://x/guide?edit"))).text(),
      );
      return await on(
        new Request("http://x/guide?edit", {
          method: "POST",
          headers: {
            Origin: "http://x",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ etag: tag, content }),
        }),
      );
    };
    assertEquals((await save("changed\r\nlines\r\n")).status, 303);
    assertEquals(
      await Deno.readTextFile(`${f.root}/guide.md`),
      "changed\nlines\n",
    );

    await Deno.writeTextFile(`${f.root}/guide.md`, "one\r\ntwo\r\n");
    assertEquals((await save("changed\nlines\n")).status, 303);
    assertEquals(
      await Deno.readFile(`${f.root}/guide.md`),
      new TextEncoder().encode(
        "changed\r\nlines\r\n",
      ),
    );

    await Deno.writeFile(
      `${f.root}/guide.md`,
      new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("old\n")]),
    );
    assertEquals((await save("new\n")).status, 303);
    assertEquals(
      await Deno.readFile(`${f.root}/guide.md`),
      new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("new\n")]),
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("text and directory-index edit pages save without JavaScript", async () => {
  const f = await fixture({
    "note.txt": "note\n",
    "docs/README.md": "# docs\n",
  });
  try {
    const on = await handler(f.root, { edit: true });
    for (
      const [route, path, content] of [
        ["/note.txt", "note.txt", "changed note\n"],
        ["/docs/", "docs/README.md", "# changed docs\n"],
      ] as const
    ) {
      const tag = pageTag(
        await (await on(new Request(`http://x${route}?edit`))).text(),
      );
      const saved = await on(
        new Request(`http://x${route}?edit`, {
          method: "POST",
          headers: {
            Origin: "http://x",
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ etag: tag, content }),
        }),
      );
      assertEquals(saved.status, 303);
      assertEquals(await Deno.readTextFile(`${f.root}/${path}`), content);
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit controls expose only eligible files and preserve index paths", async () => {
  const f = await fixture({
    "note.txt": "text\n",
    "docs/README.md": "# Docs\n",
    "binary.bin": "binary",
  });
  try {
    await Deno.writeFile(`${f.root}/binary.bin`, new Uint8Array([0, 1]));
    const off = await handler(f.root);
    assertEquals(
      (await (await off(new Request("http://x/note.txt"))).text()).includes(
        "edit-file",
      ),
      false,
    );
    assertEquals((await off(new Request("http://x/docs/?edit"))).status, 404);
    const on = await handler(f.root, { edit: true });
    assertMatch(
      await (await on(new Request("http://x/note.txt"))).text(),
      /aria-label="Text view"[\s\S]*>Source<\/a><a[^>]*href="\?edit"[^>]*>Edit<\/a>/,
    );
    assertMatch(
      await (await on(new Request("http://x/note.txt?edit"))).text(),
      /<form class="edit-page" method="post" action="\?edit" data-edit-path="note\.txt">/,
    );
    assertMatch(
      await (await on(new Request("http://x/docs/?edit"))).text(),
      /<form class="edit-page" method="post" action="\?edit" data-edit-path="docs\/README\.md">/,
    );
    for (const path of ["binary.bin", "missing.txt"]) {
      assertEquals(
        (await on(
          new Request(
            `http://x/__markdown_serve__/edit?path=${encodeURIComponent(path)}`,
          ),
        )).status,
        404,
      );
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit endpoint rejects non-text and oversized bodies", async () => {
  const f = await fixture({ "note.txt": "text\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const tag = (await on(new Request(url))).headers.get("etag")!;
    const request = (body: BodyInit) =>
      new Request(url, {
        method: "PUT",
        headers: {
          Origin: "http://x",
          "Content-Type": "text/plain; charset=UTF-8",
          "If-Match": tag,
        },
        body,
      });
    assertEquals(
      (await on(request(new Uint8Array([0])))).status,
      400,
    );
    assertEquals(
      (await on(request(new Uint8Array(editLimit + 1)))).status,
      413,
    );
    assertEquals(await Deno.readTextFile(`${f.root}/note.txt`), "text\n");
  } finally {
    await f.cleanup();
  }
});

Deno.test({
  name:
    "editing rejects links, directories, large files, and late invalid UTF-8",
  ignore: Deno.build.os === "windows",
  async fn() {
    const f = await fixture({
      "note.txt": "text\n",
      "directory/inside.txt": "inside\n",
      "large.txt": "x".repeat(editLimit + 1),
    });
    try {
      await Deno.symlink("note.txt", `${f.root}/link.txt`);
      await Deno.writeFile(
        `${f.root}/invalid.txt`,
        new Uint8Array([...new Uint8Array(9_000).fill(0x61), 0xff]),
      );
      const on = await handler(f.root, { edit: true });
      for (
        const path of [
          "link.txt",
          "directory",
          "large.txt",
          "invalid.txt",
        ]
      ) {
        assertEquals(
          (await on(
            new Request(
              `http://x/__markdown_serve__/edit?path=${path}`,
            ),
          )).status,
          404,
        );
      }
      assertEquals(
        (await (await on(new Request("http://x/link.txt"))).text()).includes(
          ">Edit</a>",
        ),
        false,
      );
    } finally {
      await f.cleanup();
    }
  },
});

Deno.test("concurrent editor writes permit only one matching version", async () => {
  const f = await fixture({ "note.txt": "first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const tag = (await on(new Request(url))).headers.get("etag")!;
    const put = (body: string) =>
      on(
        new Request(url, {
          method: "PUT",
          headers: {
            Origin: "http://x",
            "Content-Type": "text/plain; charset=UTF-8",
            "If-Match": tag,
          },
          body,
        }),
      );
    const statuses = (await Promise.all([put("one\n"), put("two\n")]))
      .map((response) => response.status).toSorted();
    assertEquals(statuses, [204, 412]);
    assertEquals(
      ["one\n", "two\n"].includes(
        await Deno.readTextFile(`${f.root}/note.txt`),
      ),
      true,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("atomic replacement handles partial writes, modes, cleanup, and directory sync", async () => {
  const writes: number[] = [];
  const calls: string[] = [];
  let temp = "";
  const fs: EditFileSystem = {
    ...Deno,
    stat: () => Promise.resolve(({ mode: 0o640 }) as Deno.FileInfo),
    open: (path) => {
      temp = String(path);
      return Promise.resolve({
        write: (bytes: Uint8Array) => {
          writes.push(bytes.length);
          return Promise.resolve(Math.min(1, bytes.length));
        },
        sync: () => {
          calls.push("sync");
          return Promise.resolve();
        },
        close: () => {
          calls.push("close");
        },
      } as unknown as Deno.FsFile);
    },
    chmod: () => {
      calls.push("chmod");
      return Promise.resolve();
    },
    rename: () => {
      calls.push("rename");
      return Promise.resolve();
    },
    remove: (path) => {
      assertEquals(path, temp);
      calls.push("remove");
      return Promise.resolve();
    },
    syncDirectory: () => {
      calls.push("directory");
      return Promise.resolve();
    },
  };
  await atomicReplace("/root/note.txt", new Uint8Array([1, 2]), fs);
  assertEquals(writes, [2, 1]);
  assertEquals(calls, [
    "sync",
    "close",
    "chmod",
    "rename",
    "directory",
    "remove",
  ]);

  const failed = {
    ...fs,
    rename: () => Promise.reject(new Error("rename")),
  };
  await assertRejects(() =>
    atomicReplace("/root/note.txt", new Uint8Array([1]), failed)
  );
  assertEquals(calls.includes("remove"), true);

  const changed = {
    ...fs,
    lstat: () =>
      Promise.resolve({ isFile: true, isSymlink: false } as Deno.FileInfo),
    readFile: () => Promise.resolve(new TextEncoder().encode("changed")),
  };
  await assertRejects(
    () =>
      atomicReplace(
        "/root/note.txt",
        new Uint8Array([1]),
        changed,
        '"stale"',
      ),
    EditConflict,
  );
});

Deno.test("edit endpoint is disabled by default and atomically saves versioned text", async () => {
  const f = await fixture({ "note.txt": "first\n", "binary.bin": "x" });
  try {
    await Deno.writeFile(`${f.root}/binary.bin`, new Uint8Array([0, 1]));
    const off = await handler(f.root);
    assertEquals(
      (await off(new Request("http://x/__markdown_serve__/edit?path=note.txt")))
        .status,
      404,
    );
    const on = await handler(f.root, { edit: true });
    if (Deno.build.os !== "windows") {
      await Deno.chmod(`${f.root}/note.txt`, 0o640);
    }
    const get = await on(
      new Request("http://x/__markdown_serve__/edit?path=note.txt"),
    );
    const tag = get.headers.get("etag")!;
    assertEquals(await get.text(), "first\n");
    const put = await on(
      new Request("http://x/__markdown_serve__/edit?path=note.txt", {
        method: "PUT",
        headers: {
          Origin: "http://x",
          "Content-Type": "text/plain; charset=UTF-8",
          "If-Match": tag,
        },
        body: "second\n",
      }),
    );
    assertEquals(put.status, 204);
    assertEquals(await Deno.readTextFile(`${f.root}/note.txt`), "second\n");
    if (Deno.build.os !== "windows") {
      assertEquals(
        (await Deno.stat(`${f.root}/note.txt`)).mode! & 0o777,
        0o640,
      );
    }
    assertEquals(
      (await Array.fromAsync(Deno.readDir(f.root))).some((entry) =>
        entry.name.startsWith(".markdown-serve-")
      ),
      false,
    );
    assertEquals(
      (await on(
        new Request("http://x/__markdown_serve__/edit?path=note.txt", {
          method: "PUT",
          headers: {
            Origin: "http://x",
            "Content-Type": "text/plain; charset=UTF-8",
            "If-Match": tag,
          },
          body: "lost",
        }),
      )).status,
      412,
    );
    for (const path of ["../note.txt", "binary.bin", "missing.txt"]) {
      assertEquals(
        (await on(
          new Request(
            `http://x/__markdown_serve__/edit?path=${encodeURIComponent(path)}`,
          ),
        )).status,
        404,
      );
    }
    assertEquals(
      (await on(
        new Request("http://x/__markdown_serve__/edit?path=note.txt", {
          method: "POST",
        }),
      )).headers.get("allow"),
      "GET, HEAD, PUT",
    );
  } finally {
    await f.cleanup();
  }
});

function pageTag(html: string): string {
  const value = html.match(/name="etag" value="([^"]+)"/)?.[1];
  if (!value) {
    throw new Error("missing edit tag");
  }
  return value.replaceAll("&quot;", '"');
}
