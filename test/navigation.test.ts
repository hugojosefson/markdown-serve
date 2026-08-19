import { assert, assertEquals, assertMatch } from "@std/assert";
import { fixture, handler } from "./fixture.ts";

Deno.test("generated pages include responsive navigation and active branches", async () => {
  const f = await fixture({
    "guide.md": "guide",
    "docs/README.md": "docs",
    "docs/nested/note.md": "note",
    "empty/.dot": "dot",
  });
  try {
    const h = await handler(f.root);
    const guideBody = await (await h(new Request("http://x/guide"))).text();
    assertMatch(guideBody, /class="browse"/);
    assertMatch(guideBody, /class="tree"/);
    assertMatch(guideBody, /markdown-body/);
    assertMatch(guideBody, /data-color-mode="auto"/);
    assertMatch(guideBody, /color-scheme: light dark/);
    assertMatch(guideBody, /prefers-color-scheme: dark/);
    assertMatch(guideBody, /font-family: -apple-system, BlinkMacSystemFont/);
    assertMatch(
      guideBody,
      /\.tree \.active \{ background: var\(--tree-active\); color: #fff/,
    );
    assertMatch(guideBody, /tree\?path=/);
    assertMatch(guideBody, /tree\?\.addEventListener\('toggle'/);
    assertMatch(guideBody, /}, true\);/);
    assertMatch(
      guideBody,
      /aria-label="Breadcrumb"><a href="\/">Home<\/a> \/ <a href="\/guide">guide<\/a>/,
    );
    assertMatch(guideBody, /data-path="docs"/);
    assertMatch(guideBody, /__markdown_server__\/tree\?path=/);
    assertMatch(guideBody, /class="active"/);
    assert(!guideBody.includes('data-path="docs/nested"'));

    const docsBody = await (await h(new Request("http://x/docs/"))).text();
    assertMatch(docsBody, /data-path="docs" data-loaded="true" open/);
    assertMatch(docsBody, /data-path="docs\/nested"/);
    assertMatch(docsBody, /href="\/docs\/">docs<\/a>/);

    const emptyBody = await (await h(new Request("http://x/empty/"))).text();
    assertMatch(emptyBody, /Index of/);
    assertMatch(emptyBody, /\.dot/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("reserved tree endpoint is lazy, safe, and wins namespace collisions", async () => {
  const f = await fixture({
    "docs/.dot": "dot",
    "docs/file.txt": "file",
    "docs/README.md": "readme",
    "docs/ordinary.md": "ordinary",
    "docs/sub/file.txt": "sub",
    "docs/percent%zz/file.txt": "percent",
    "__markdown_server__/tree": "collision",
  });
  try {
    const h = await handler(f.root);
    const treeResponse = await h(
      new Request("http://x/__markdown_server__/tree?path=docs"),
    );
    assertEquals(
      treeResponse.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
    const children = await treeResponse.json() as Array<{
      name: string;
      href: string;
    }>;
    assert(
      children.some((child) => child.name === ".dot"),
      "includes dotfiles",
    );
    assertEquals(
      children.filter((child) => child.name !== ".dot").map((child) =>
        child.href
      ),
      [
        "/docs/",
        "/docs/file.txt",
        "/docs/ordinary",
        "/docs/percent%25zz/",
        "/docs/sub/",
      ],
    );

    const percentResponse = await h(
      new Request(
        "http://x/__markdown_server__/tree?path=docs%2Fpercent%25zz",
      ),
    );
    assertEquals(
      (await percentResponse.json())[0].href,
      "/docs/percent%25zz/file.txt",
    );

    const postResponse = await h(
      new Request("http://x/__markdown_server__/tree", { method: "POST" }),
    );
    assertEquals([postResponse.status, postResponse.headers.get("allow")], [
      405,
      "GET, HEAD",
    ]);
    const traversalResponse = await h(
      new Request("http://x/__markdown_server__/tree?path=%2e%2e%2f"),
    );
    assertEquals(traversalResponse.status, 400);
    const rootResponse = await h(
      new Request("http://x/__markdown_server__/tree"),
    );
    assertEquals(
      rootResponse.headers.get("content-type"),
      "application/json; charset=utf-8",
    );
  } finally {
    await f.cleanup();
  }
});
