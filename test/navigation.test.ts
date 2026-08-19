import { assert, assertEquals, assertMatch } from "@std/assert";
import { breadcrumbPath, breadcrumbs } from "../src/server/breadcrumb.ts";
import { ensureEndsWithSlash } from "../src/server/create-handler.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("generated pages include responsive navigation and active branches", async () => {
  const f = await fixture({
    "README.md": "root",
    "guide.md": "guide",
    "docs/README.md": "docs",
    "docs/nested/note.md": "note",
    "empty/.dot": "dot",
    "plain.txt": "plain",
  });
  try {
    const h = await handler(f.root);
    const guideBody = await (await h(new Request("http://x/guide"))).text();
    assertMatch(guideBody, /<a class="browse" href="#browse">Browse<\/a>/);
    assertMatch(guideBody, /class="tree"/);
    assertMatch(
      guideBody,
      /<a href="\/" class="tree-heading">Files<\/a>/,
    );
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
    const rootLabel = `${f.root}/`;
    assert(guideBody.includes(`href="/">${rootLabel}</a>`));
    assertMatch(
      guideBody,
      /aria-label="Breadcrumb"><a href="\/">.+<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">guide<\/span>/,
    );
    assertMatch(guideBody, /data-path="docs"/);
    assertMatch(guideBody, /href="\/">README\.md<\/a>/);
    assert(!guideBody.includes('href="//"'));
    assertMatch(guideBody, /__markdown_server__\/tree\?path=/);
    assertMatch(guideBody, /class="active"/);
    assert(!guideBody.includes('data-path="docs/nested"'));

    const plainBody = await (await h(new Request("http://x/plain.txt"))).text();
    assert(plainBody.includes(
      `<header class="content-header"><nav aria-label="Breadcrumb"><a href="/">${
        rootLabel.slice(0, -1)
      }</a><span class="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">plain.txt</span></nav><a class="raw-link"`,
    ));
    assertMatch(
      plainBody,
      /<a class="raw-link" href="\?raw">Raw<\/a>/,
    );
    assertMatch(
      plainBody,
      /\.content-header \{ align-items: center; display: flex/,
    );
    assertMatch(
      plainBody,
      /\.raw-link \{[^}]*flex: 0 0 auto/,
    );
    assert(!plainBody.includes("float: right"));
    assertMatch(plainBody, /\.tree:target \{ display: block; \}/);
    assert(!plainBody.includes("browse?.addEventListener"));

    const docsBody = await (await h(new Request("http://x/docs/"))).text();
    assertMatch(docsBody, /data-path="docs" data-loaded="true" open/);
    assertMatch(docsBody, /data-path="docs\/nested"/);
    assertMatch(docsBody, /aria-current="page">docs\/<\/span>/);

    const emptyBody = await (await h(new Request("http://x/empty/"))).text();
    assertMatch(
      emptyBody,
      /<div class="directory-scroll"><table class="directory-table">/,
    );
    assert(!emptyBody.includes('<h1><a href="/">FILES'));
    assertMatch(emptyBody, /\.dot/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("breadcrumbs copy as exact configured paths", () => {
  const text = (html: string) => html.replace(/<[^>]+>/g, "");
  assertEquals(text(breadcrumbs("./", ["coverage"], true)), "./coverage/");
  assertEquals(
    text(breadcrumbs("docs///", ["nested", "file.txt"], false)),
    "docs/nested/file.txt",
  );
  assertEquals(text(breadcrumbs("/", ["coverage"], true)), "/coverage/");
  assertEquals(text(breadcrumbs("./", [], true)), "./");
  assertEquals(breadcrumbPath("docs///", ["nested"]), "docs/nested/");
});

Deno.test("root labels preserve the configured argument and escape HTML", async () => {
  assertEquals(ensureEndsWithSlash("."), "./");
  assertEquals(ensureEndsWithSlash("docs"), "docs/");
  assertEquals(ensureEndsWithSlash("docs/"), "docs/");
  const f = await fixture({ "root<&/README.md": "root" });
  try {
    const root = `${f.root}/root<&`;
    const h = await handler(root);
    const body = await (await h(new Request("http://x/"))).text();
    const label = `${root.replace("&", "&amp;").replace("<", "&lt;")}/`;
    assert(body.includes(`class="tree-root active" href="/">${label}</a>`));
    assert(
      body.includes(
        `aria-label="Breadcrumb"><span aria-current="page">${label}</span>`,
      ),
    );
    assert(!body.includes(`>${root}/</a>`));

    const trailing = await handler(`${root}/`);
    const trailingBody = await (await trailing(new Request("http://x/")))
      .text();
    assert(trailingBody.includes(`href="/">${label}</a>`));
  } finally {
    await f.cleanup();
  }
});

Deno.test("reserved tree endpoint is lazy, safe, and wins namespace collisions", async () => {
  const f = await fixture({
    "README.md": "root",
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
    assertEquals(
      (await rootResponse.json()).find((
        child: { name: string; href: string },
      ) => child.name === "README.md")?.href,
      "/",
    );
  } finally {
    await f.cleanup();
  }
});
