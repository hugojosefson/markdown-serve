import { assert, assertEquals, assertMatch } from "@std/assert";
import { breadcrumbPath, breadcrumbs } from "../src/server/breadcrumb.ts";
import { ensureEndsWithSlash } from "../src/server/create-handler.ts";
import { pageClient } from "../src/server/page-client.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("generated pages include responsive navigation and active branches", async () => {
  const f = await fixture({
    "README.md": "root",
    "AGENTS.md": "agents",
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
      /<a href="\/\?dir" class="tree-heading">Files<\/a>/,
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
    assert(
      guideBody.includes(
        `class="tree-root" href="/" data-query-remove="dir">${rootLabel}</a>`,
      ),
    );
    assertMatch(
      guideBody,
      /aria-label="Breadcrumb"><a href="\/\?dir">.+<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">guide\.md<\/span>/,
    );
    assertMatch(guideBody, /data-path="docs"/);
    assertMatch(
      guideBody,
      /<summary><a class="tree-folder-link" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir" title="Show files in docs" aria-label="Show files in docs">Files<\/a><\/summary>/,
    );
    assertMatch(guideBody, /\.tree \.(?:tree-files-link) \{[^}]*opacity: 0/);
    assertMatch(
      guideBody,
      /\.tree summary:hover \.tree-files-link, \.tree summary:focus-within \.tree-files-link, \.tree \.tree-files-link:focus-visible \{ opacity: 1; pointer-events: auto; \}/,
    );
    assertMatch(
      guideBody,
      /@media \(hover: none\) \{ \.tree \.tree-files-link \{ opacity: 1; pointer-events: auto; \} \}/,
    );
    assertMatch(guideBody, /href="\/" data-query-remove="dir">README\.md<\/a>/);
    assert(!guideBody.includes('href="//"'));
    assertMatch(guideBody, /__markdown_server__\/tree\?path=/);
    assertMatch(guideBody, /class="active"/);
    assert(!guideBody.includes('data-path="docs/nested"'));

    const agentsBody = await (await h(new Request("http://x/AGENTS"))).text();
    assertMatch(
      agentsBody,
      /aria-label="Breadcrumb"><a href="\/\?dir">.+<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">AGENTS\.md<\/span>/,
    );

    const plainBody = await (await h(new Request("http://x/plain.txt"))).text();
    assert(plainBody.includes(
      `<header class="content-header"><nav aria-label="Breadcrumb"><a href="/?dir">${
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
    assertMatch(
      docsBody,
      /<a href="\/docs\/\?dir">docs<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">README\.md<\/span>/,
    );

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
  assertEquals(
    text(breadcrumbs("./", ["docs"], true, "README.md")),
    "./docs/README.md",
  );
  assertEquals(
    text(breadcrumbs("./", ["AGENTS"], false, "AGENTS.md")),
    "./AGENTS.md",
  );
  assertEquals(text(breadcrumbs("./", [], true, "README.md")), "./README.md");
  assertEquals(breadcrumbPath("docs///", ["nested"]), "docs/nested/");
});

Deno.test("current directory links toggle their details without navigation", () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  class Details {
    open = true;
    dataset = { path: "docs" };
  }
  const details = new Details();
  const link = {
    href: "/docs/",
    closest: (selector: string) =>
      selector === "details[data-path]" ? details : null,
  };
  const tree = {
    addEventListener: (
      name: string,
      listener: (event: Record<string, unknown>) => void,
    ) => listeners.set(name, listener),
  };
  const location = { href: "http://x/docs/?dir", pathname: "/docs/" };
  new Function(
    "document",
    "HTMLDetailsElement",
    "location",
    "fetch",
    pageClient,
  )(
    {
      documentElement: { dataset: { directoryView: "true" } },
      querySelector: () => tree,
    },
    Details,
    location,
    () => Promise.reject(new Error("not fetched")),
  );
  const click = (overrides: Record<string, unknown> = {}) => {
    let prevented = false;
    listeners.get("click")?.({
      altKey: false,
      button: 0,
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => prevented = true,
      shiftKey: false,
      target: {
        closest: (selector: string) =>
          selector === "details[data-path] > summary > .tree-folder-link"
            ? link
            : null,
      },
      ...overrides,
    });
    return prevented;
  };
  assert(click());
  assertEquals(details.open, false);
  assertEquals(location, { href: "http://x/docs/?dir", pathname: "/docs/" });
  assert(click());
  assertEquals(details.open, true);
  assert(!click({ ctrlKey: true }));
  const filesLink = { closest: () => details, href: "/docs/?dir" };
  assert(
    !click({
      target: {
        closest: (selector: string) =>
          selector === "details[data-path] > summary > .tree-folder-link"
            ? null
            : filesLink,
      },
    }),
  );
  assert(!click({ target: { closest: () => null } }));
  link.href = "/other/";
  assert(!click());
  assert(!pageClient.includes("history."));
});

Deno.test("directory listings activate only their current tree directory", async () => {
  const f = await fixture({ "docs/nested/note.md": "note" });
  try {
    const body = await (await handler(f.root))(
      new Request("http://x/docs/nested/?dir"),
    ).then((response) => response.text());
    assertMatch(
      body,
      /data-path="docs" data-loaded="true" open><summary><a class="tree-folder-link" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir"/,
    );
    assertMatch(
      body,
      /data-path="docs\/nested" data-loaded="true" open><summary><a class="active tree-folder-link" href="\/docs\/nested\/" data-query-remove="dir">nested\/<\/a><a class="tree-files-link" href="\/docs\/nested\/\?dir"/,
    );
  } finally {
    await f.cleanup();
  }
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
    assert(
      body.includes(
        `class="tree-root" href="/" data-query-remove="dir">${label}</a>`,
      ),
    );
    assert(
      body.includes(
        `aria-label="Breadcrumb"><a href="/?dir">${
          label.slice(0, -1)
        }</a><span class="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">README.md</span>`,
      ),
    );
    assert(!body.includes(`>${root}/</a>`));

    const trailing = await handler(`${root}/`);
    const trailingBody = await (await trailing(new Request("http://x/")))
      .text();
    assert(
      trailingBody.includes(
        `href="/" data-query-remove="dir">${label}</a>`,
      ),
    );
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
    assertEquals(
      children.find((child) => child.name === "README.md") as unknown,
      {
        name: "README.md",
        path: "docs/README.md",
        directory: false,
        href: "/docs/",
        queryRemove: ["dir"],
      },
    );
    assertEquals(
      children.find((child) => child.name === "sub") as unknown,
      {
        name: "sub",
        path: "docs/sub",
        directory: true,
        href: "/docs/sub/",
        filesHref: "/docs/sub/?dir",
        queryRemove: ["dir"],
      },
    );
    assert(pageClient.includes("filesLink.href = entry.filesHref"));
    assert(pageClient.includes("summary.append(link, filesLink)"));

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
