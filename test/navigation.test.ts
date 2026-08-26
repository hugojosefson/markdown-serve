import { assert, assertEquals, assertMatch } from "@std/assert";
import { breadcrumbPath, breadcrumbs } from "../src/server/breadcrumb.ts";
import { ensureEndsWithSlash } from "../src/server/create-handler.ts";
import { pageScript, pageStylesheet } from "../src/server/page-assets.ts";
import { pageCss } from "../src/server/page-css.ts";
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
    assertMatch(guideBody, /class="tree"/);
    assert(!guideBody.includes('class="browse"'));
    assert(!guideBody.includes("tree-heading"));
    assertMatch(guideBody, /markdown-body/);
    assertMatch(guideBody, /data-color-mode="auto"/);
    assertMatch(guideBody, new RegExp(`href="${pageStylesheet.url}"`));
    assertMatch(guideBody, new RegExp(`src="${pageScript.url}"`));
    assertMatch(pageCss, /color-scheme: light dark/);
    assertMatch(pageCss, /prefers-color-scheme: dark/);
    assertMatch(pageCss, /font-family: -apple-system, BlinkMacSystemFont/);
    assertMatch(
      pageCss,
      /\.tree \.active \{ background: var\(--tree-active\); color: #fff/,
    );
    assertMatch(pageScript.body, /tree\?path=/);
    assertMatch(pageScript.body, /tree\?\.addEventListener\('toggle'/);
    assertMatch(pageScript.body, /}, true\);/);
    const rootLabel = `${f.root}/`;
    assert(
      guideBody.includes(
        `class="tree-root" href="/" data-query-remove="dir">${rootLabel}</a>`,
      ),
    );
    assertMatch(
      guideBody,
      /<div class="tree-root-row"><a class="tree-root" href="\/" data-query-remove="dir">.+<\/a><a class="tree-files-link" href="\/\?dir" data-query-scope="directory" title="Show files in .+" aria-label="Show files in .+">Files<\/a><\/div>/,
    );
    assertMatch(
      guideBody,
      /aria-label="Breadcrumb"><a href="\/\?dir" data-query-scope="directory">.+<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">guide\.md<\/span>/,
    );
    assertMatch(guideBody, /data-path="docs"/);
    assertMatch(
      guideBody,
      /data-path="docs"><summary><a class="tree-folder-link" data-kind="directory" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir" data-query-scope="directory"/,
    );
    assertMatch(
      pageCss,
      /\.tree \.tree-files-link \{[^}]*bottom: 0;[^}]*display: flex;[^}]*opacity: 0;[^}]*position: absolute; right: 0; top: 0/,
    );
    assertMatch(
      pageCss,
      /\.tree summary:hover \.tree-files-link, \.tree summary:focus-within \.tree-files-link, \.tree \.tree-root-row:hover \.tree-files-link/,
    );
    assertMatch(guideBody, /href="\/" data-query-remove="dir">README\.md<\/a>/);
    assert(!guideBody.includes('href="//"'));
    assertMatch(pageScript.body, /__markdown_serve__\/tree\?path=/);
    assertMatch(guideBody, /class="active"/);
    assert(!guideBody.includes('data-path="docs/nested"'));

    const agentsBody = await (await h(new Request("http://x/AGENTS"))).text();
    assertMatch(
      agentsBody,
      /aria-label="Breadcrumb"><a href="\/\?dir" data-query-scope="directory">.+<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">AGENTS\.md<\/span>/,
    );

    const plainBody = await (await h(new Request("http://x/plain.txt"))).text();
    assert(plainBody.includes(
      `<header class="content-header"><nav aria-label="Breadcrumb"><a href="/?dir" data-query-scope="directory">${
        rootLabel.slice(0, -1)
      }</a><span class="breadcrumb-separator" aria-hidden="true">/</span><span aria-current="page">plain.txt</span></nav>`,
    ));
    assertMatch(
      plainBody,
      /<button class="code-copy"[^>]*>Copy<\/button><span class="code-toolbar-file-actions" data-file-actions="trailing"><a class="file-action raw-link" href="\?raw" title="View raw content \(text\/plain; charset=UTF-8\)" aria-label="View raw content \(text\/plain; charset=UTF-8\)">Raw<\/a>/,
    );
    assertMatch(
      pageCss,
      /\.content-header \{ align-items: center; display: flex/,
    );
    assertMatch(pageCss, /html \{ scrollbar-gutter: stable; \}/);
    assertMatch(
      pageCss,
      /\.file-action \{[^}]*color: var\(--code-muted\)/,
    );
    assertMatch(
      pageCss,
      /\.content-header \.page-action \{[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/,
    );
    assert(!pageCss.includes(".tree { float: right"));
    assert(!pageCss.includes(".tree:target"));
    assert(!pageScript.body.includes("browse?.addEventListener"));
    assertMatch(pageCss, /@media \(max-width: 560px\)/);
    assertMatch(
      plainBody,
      /<aside class="tree"><details class="tree-disclosure" open><summary>Files<\/summary><nav/,
    );
    assertMatch(pageClient, /matchMedia\?\.\('\(max-width: 560px\)'\)/);
    assertMatch(
      pageClient,
      /addEventListener\?\.\('change', syncTreeDisclosure\)/,
    );

    const docsBody = await (await h(new Request("http://x/docs/"))).text();
    assertMatch(docsBody, /data-path="docs" data-loaded="true" open/);
    assertMatch(docsBody, /data-path="docs\/nested"/);
    assertMatch(
      docsBody,
      /<a href="\/docs\/\?dir" data-query-scope="directory">docs<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">README\.md<\/span>/,
    );

    const emptyBody = await (await h(new Request("http://x/empty/"))).text();
    assertMatch(
      emptyBody,
      /<div class="directory-scroll"><table class="directory-table">/,
    );
    assert(!emptyBody.includes('<h1><a href="/">FILES'));
    assertMatch(emptyBody, /\.dot/);
    assertMatch(
      emptyBody,
      /data-path="empty"[^>]*><summary><a class="(?:active )?tree-folder-link" data-kind="directory" href="\/empty\/" data-query-remove="dir">empty\/<\/a><a class="tree-files-link" href="\/empty\/" data-query-scope="directory"/,
    );
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

Deno.test("folder controls toggle only when they already target the current page", () => {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const details = { open: true };
  const folderLink = {
    href: "/readme/",
    closest: (selector: string) =>
      selector === "details[data-path]" ? details : null,
  };
  const filesLink = {
    href: "/readme/?dir",
    closest: folderLink.closest,
  };
  const tree = {
    addEventListener: (
      name: string,
      listener: (event: Record<string, unknown>) => void,
    ) => listeners.set(name, listener),
  };
  const location = {
    href: "http://x/readme/",
    pathname: "/readme/",
    search: "",
  };
  new Function(
    "document",
    "HTMLDetailsElement",
    "location",
    "fetch",
    pageClient,
  )(
    { querySelector: () => tree, querySelectorAll: () => [] },
    class {},
    location,
    () => Promise.reject(new Error("not fetched")),
  );
  const click = (link: typeof folderLink) => {
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
          selector ===
              "details[data-path] > summary > .tree-folder-link, details[data-path] > summary > .tree-files-link"
            ? link
            : null,
      },
    });
    return prevented;
  };
  assert(click(folderLink));
  assertEquals(details.open, false);
  assert(!click(filesLink));
  location.href = "http://x/readme/?a=2&a=1&dir&theme=dark";
  location.pathname = "/readme/";
  location.search = "?a=2&a=1&dir&theme=dark";
  folderLink.href = "/readme/?a=1&a=2&theme=dark";
  filesLink.href = "/readme/?a=1&a=2&dir&theme=dark";
  assert(!click(folderLink));
  assertEquals(details.open, false);
  assert(click(filesLink));
  assertEquals(details.open, true);
  location.href = "http://x/other/";
  location.pathname = "/other/";
  location.search = "";
  assert(!click(folderLink));
});

Deno.test("directory listings activate only their current tree directory", async () => {
  const f = await fixture({
    "docs/README.md": "docs",
    "docs/nested/INDEX.md": "nested",
    "docs/nested/note.md": "note",
  });
  try {
    const body = await (await handler(f.root))(
      new Request("http://x/docs/nested/?dir"),
    ).then((response) => response.text());
    assertMatch(
      body,
      /data-path="docs" data-loaded="true" open><summary><a class="tree-folder-link" data-kind="directory" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir" data-query-scope="directory"/,
    );
    assertMatch(
      body,
      /data-path="docs\/nested" data-loaded="true" open><summary><a class="active tree-folder-link" data-kind="directory" href="\/docs\/nested\/" data-query-remove="dir">nested\/<\/a><a class="tree-files-link" href="\/docs\/nested\/\?dir" data-query-scope="directory"/,
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
        `aria-label="Breadcrumb"><a href="/?dir" data-query-scope="directory">${
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

Deno.test("root Files control is available without a renderable index", async () => {
  const f = await fixture({ "docs/README.md": "docs" });
  try {
    const body = await (await handler(f.root))(new Request("http://x/"))
      .then((response) => response.text());
    assertMatch(
      body,
      /<div class="tree-root-row"><a class="tree-root(?: active)?" href="\/" data-query-remove="dir">.+<\/a><a class="tree-files-link" href="\/" data-query-scope="directory"/,
    );
    assert(body.includes('title="Show files in ' + `${f.root}/`));
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
    "docs/indexed/README.md": "indexed",
    "docs/unindexed/file.txt": "unindexed",
    "docs/sub/file.txt": "sub",
    "docs/percent%zz/file.txt": "percent",
    "__markdown_serve__/tree": "collision",
  });
  try {
    const h = await handler(f.root);
    const treeResponse = await h(
      new Request("http://x/__markdown_serve__/tree?path=docs"),
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
        "/docs/indexed/",
        "/docs/percent%25zz/",
        "/docs/sub/",
        "/docs/unindexed/",
        "/docs/",
        "/docs/file.txt",
        "/docs/ordinary",
      ],
    );
    assertEquals(
      children.find((child) => child.name === "README.md") as unknown,
      {
        name: "README.md",
        path: "docs/README.md",
        directory: false,
        href: "/docs/",
        filesHref: "/docs/?dir",
        filesLabel: "docs",
        queryRemove: ["dir"],
        kind: "file",
      },
    );
    assertEquals(
      children.find((child) => child.name === "indexed") as unknown,
      {
        name: "indexed",
        path: "docs/indexed",
        directory: true,
        href: "/docs/indexed/",
        filesHref: "/docs/indexed/?dir",
        queryRemove: ["dir"],
        kind: "directory",
      },
    );
    assertEquals(
      (children.find((child) => child.name === "unindexed") as {
        filesHref?: string;
      }).filesHref,
      "/docs/unindexed/?dir",
    );
    const rootChildren = await (
      await h(new Request("http://x/__markdown_serve__/tree"))
    ).json() as Array<{ name: string; filesHref?: string }>;
    assertEquals(
      rootChildren.find((child) => child.name === "docs")?.filesHref,
      "/docs/?dir",
    );
    assertEquals(
      rootChildren.find((child) => child.name === "__markdown_serve__")
        ?.filesHref,
      "/__markdown_serve__/",
    );
    assert(!pageClient.includes("/__markdown_serve__/index"));
    assert(!pageClient.includes("indexPending"));

    const percentResponse = await h(
      new Request(
        "http://x/__markdown_serve__/tree?path=docs%2Fpercent%25zz",
      ),
    );
    assertEquals(
      (await percentResponse.json())[0].href,
      "/docs/percent%25zz/file.txt",
    );

    const postResponse = await h(
      new Request("http://x/__markdown_serve__/tree", { method: "POST" }),
    );
    assertEquals([postResponse.status, postResponse.headers.get("allow")], [
      405,
      "GET, HEAD",
    ]);
    const traversalResponse = await h(
      new Request("http://x/__markdown_serve__/tree?path=%2e%2e%2f"),
    );
    assertEquals(traversalResponse.status, 400);
    assertEquals(
      (await h(new Request("http://x/__markdown_serve__/index?path=docs")))
        .status,
      404,
    );
    const rootResponse = await h(
      new Request("http://x/__markdown_serve__/tree"),
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
