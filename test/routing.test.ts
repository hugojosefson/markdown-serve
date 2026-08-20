import { assert, assertEquals, assertMatch } from "@std/assert";
import { directoryIndex } from "../src/server/directory-index.ts";
import { pageCss } from "../src/server/page-css.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("Markdown routes, redirects, and relative URLs are canonical", async () => {
  const f = await fixture({
    "guide.md": "[asset](asset.png) ![image](image.png)",
    "guide/child.txt": "directory",
    "space #?.md": "space",
    "docs/README.md": "[readme asset](asset.png)",
    "docs/index.md": "index",
  });
  try {
    const h = await handler(f.root, { redirectStatus: 301 });
    const guideAlias = await h(new Request("http://example.test/guide.md?q=1"));
    assertEquals([guideAlias.status, guideAlias.headers.get("location")], [
      301,
      "/guide?q=1",
    ]);
    const sortedAlias = await h(
      new Request("http://example.test/guide.md?z=2&a=2&a=1&flag"),
    );
    assertEquals(
      sortedAlias.headers.get("location"),
      "/guide?a=1&a=2&flag&z=2",
    );
    const guide = await h(new Request("http://example.test/guide"));
    const guideBody = await guide.text();
    assertMatch(guideBody, /href="http:\/\/example\.test\/asset\.png"/);
    assertMatch(guideBody, /src="http:\/\/example\.test\/image\.png"/);
    const guideDirectory = await h(new Request("http://example.test/guide/"));
    assertMatch(await guideDirectory.text(), /child\.txt/);
    const docs = await h(new Request("http://example.test/docs/"));
    assertMatch(
      await docs.text(),
      /href="http:\/\/example\.test\/docs\/asset\.png"/,
    );
    for (const alias of ["README.md", "index.md"]) {
      const aliasResponse = await h(
        new Request(`http://example.test/docs/${alias}?x=1`),
      );
      assertEquals(aliasResponse.headers.get("location"), "/docs/?x=1");
    }
    const encoded = await h(
      new Request("http://example.test/space%20%23%3F.md?q=1"),
    );
    assertEquals(encoded.headers.get("location"), "/space%20%23%3F?q=1");
  } finally {
    await f.cleanup();
  }
});

Deno.test("clean Markdown routes select mixed-case extensions deterministically", async () => {
  const f = await fixture({
    "guide.md": "lowercase",
    "guide.MD": "uppercase",
    "topic.mD": "first fallback",
    "topic.Md": "second fallback",
  });
  try {
    const h = await handler(f.root);
    assertMatch(
      await (await h(new Request("http://x/guide"))).text(),
      /lowercase/,
    );
    assertMatch(
      await (await h(new Request("http://x/topic"))).text(),
      /second fallback/,
    );
    assertEquals(
      (await h(new Request("http://x/guide.MD"))).headers.get("location"),
      "/guide",
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("directory tables expose metadata and support deterministic sorting", async () => {
  const f = await fixture({
    "list/a-small": "x",
    "list/b-large": "x".repeat(2048),
    "list/c-medium": "x".repeat(1024),
    "list/d-tie": "x".repeat(1024),
    "list/z-dir/.keep": "x",
  });
  try {
    if (Deno.build.os !== "windows") {
      await Promise.all([
        Deno.chmod(`${f.root}/list/a-small`, 0o600),
        Deno.chmod(`${f.root}/list/b-large`, 0o755),
        Deno.chmod(`${f.root}/list/c-medium`, 0o644),
        Deno.chmod(`${f.root}/list/d-tie`, 0o644),
      ]);
      await Deno.symlink("missing", `${f.root}/list/y-broken`);
    }
    const h = await handler(f.root);
    const names = async (search = "") => {
      const body = await (await h(new Request(`http://x/list/${search}`)))
        .text();
      const rows = body.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
      return [
        ...rows.matchAll(
          /<td class="directory-name"><a href="[^"]+">([^<]+)<\/a><\/td>/g,
        ),
      ]
        .map((match) => match[1]);
    };
    const missing = Deno.build.os === "windows" ? [] : ["y-broken"];
    assertEquals(await names(), [
      "a-small",
      "b-large",
      "c-medium",
      "d-tie",
      ...missing,
      "z-dir/",
    ]);
    assertEquals(await names("?order=name-desc"), [
      "z-dir/",
      ...missing,
      "d-tie",
      "c-medium",
      "b-large",
      "a-small",
    ]);
    assertEquals(await names("?order=size"), [
      ...missing,
      "z-dir/",
      "a-small",
      "c-medium",
      "d-tie",
      "b-large",
    ]);
    assertEquals(await names("?order=size-desc"), [
      ...missing,
      "z-dir/",
      "b-large",
      "c-medium",
      "d-tie",
      "a-small",
    ]);
    assertEquals(await names("?order=invalid"), await names());

    const body = await (await h(
      new Request(
        "http://x/list/?width=wide&order=size&theme=dark&a=2&a=1",
      ),
    )).text();
    assertMatch(
      body,
      /<caption class="sr-only">Files at .+\/list\/<\/caption>/,
    );
    assertMatch(body, /<a href="a-small">a-small<\/a>/);
    assertMatch(body, /-rw-------/);
    assertMatch(body, /title="1024 bytes">1K<\/td>/);
    assertMatch(
      body,
      /href="\?a=1&amp;a=2&amp;theme=dark&amp;width=wide">Name/,
    );
    assertMatch(
      body,
      /href="\?a=1&amp;a=2&amp;order=permissions&amp;theme=dark&amp;width=wide">Permissions/,
    );
    assertMatch(
      body,
      /href="\?a=1&amp;a=2&amp;order=size-desc&amp;theme=dark&amp;width=wide">Size ↑/,
    );
    assert(!body.includes("<h1>"));

    if (Deno.build.os !== "windows") {
      assertEquals(await names("?order=permissions"), [
        "y-broken",
        "a-small",
        "c-medium",
        "d-tie",
        "b-large",
        "z-dir/",
      ]);
      assertEquals(await names("?order=permissions-desc"), [
        "y-broken",
        "z-dir/",
        "b-large",
        "c-medium",
        "d-tie",
        "a-small",
      ]);
      assertMatch(
        body,
        /<td class="directory-name"><a href="y-broken">y-broken<\/a><\/td><td class="directory-permissions">\?{10}<\/td><td class="directory-size">—<\/td><td class="directory-user">—<\/td><td class="directory-modified">—<\/td>/,
      );
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("directory metadata columns sort missing values first and render copyable ISO times", () => {
  const info = (
    uid: number | null,
    mtime: Date | null,
    size: number,
    mode: number | null = 0o644,
  ) => ({ uid, mtime, size, mode, isDirectory: false }) as Deno.FileInfo;
  const entries = [
    { name: "a-missing", directory: false, info: undefined },
    { name: "b-directory", directory: true, info: info(null, null, 0, null) },
    {
      name: "c-low",
      directory: false,
      info: info(10, new Date("2020-01-02T03:04:05.678Z"), 1),
    },
    {
      name: "d-high",
      directory: false,
      info: info(20, new Date("2021-02-03T04:05:06.789Z"), 2048, 0o755),
    },
    {
      name: "e-tie",
      directory: false,
      info: info(20, new Date("2021-02-03T04:05:06.789Z"), 2048, 0o755),
    },
  ];
  const names = (order: string) => {
    const html = directoryIndex(
      entries,
      new URL(`http://x/list/?order=${order}`),
      "list/",
    );
    return [...html.matchAll(/class="directory-name"><a href="[^"]+">([^<]+)/g)]
      .map((match) => match[1]);
  };
  const ascending = ["a-missing", "b-directory/", "c-low", "d-high", "e-tie"];
  const descending = ["a-missing", "b-directory/", "d-high", "e-tie", "c-low"];
  for (const field of ["permissions", "size", "user", "modified"]) {
    assertEquals(names(field), ascending, `${field} ascending`);
    assertEquals(names(`${field}-desc`), descending, `${field} descending`);
  }

  const html = directoryIndex(
    entries,
    new URL("http://x/list/?theme=dark"),
    "list/",
  );
  assertMatch(
    html,
    /<thead><tr><th class="directory-name"[^>]*>.*Name.*<th class="directory-permissions"[^>]*>.*Permissions.*<th class="directory-size"[^>]*>.*Size.*<th class="directory-user"[^>]*>.*User.*<th class="directory-modified"[^>]*>.*Modified/,
  );
  assertMatch(html, /href="\?order=user&amp;theme=dark">User/);
  assertMatch(html, /href="\?order=modified&amp;theme=dark">Modified/);
  assertMatch(html, /<td class="directory-user">10<\/td>/);
  assertMatch(html, /<td class="directory-user">—<\/td>/);
  const iso = "2020-01-02T03:04:05.678Z";
  assertMatch(html, new RegExp(`<time datetime="${iso}" aria-label="${iso}">`));
  const time = html.match(/<time [^>]+>[\s\S]*?<\/time>/)?.[0] ?? "";
  assertEquals(time.replace(/<[^>]+>/g, ""), iso);
  assertMatch(time, /class="timestamp-separator timestamp-t">T<\/span>/);
  assertMatch(time, /class="timestamp-separator timestamp-zone">Z<\/span>/);
  assertMatch(html, /<td class="directory-modified">—<\/td>/);
  assertMatch(
    pageCss,
    /\.directory-table \.timestamp-separator \{ color: var\(--code-muted\); \}/,
  );
  assertMatch(
    pageCss,
    /\.timestamp-t \{ display: inline-block; margin: 0 \.25ch; \}/,
  );
  assertMatch(
    pageCss,
    /\.directory-table \.timestamp-t, \.directory-table \.timestamp-zone \{ opacity: \.2; \}/,
  );
  assertMatch(
    pageCss,
    /\.directory-table \{[^}]*min-width: 100%; width: max-content;/,
  );
  assertMatch(
    pageCss,
    /\.directory-scroll \{ max-width: 100%; overflow-x: auto; width: 100%; \}/,
  );
  assertMatch(
    pageCss,
    /\.directory-table \.directory-name \{[^}]*width: 100%;/,
  );
  assertMatch(
    pageCss,
    /\.directory-table \.directory-permissions,[^}]*\.directory-modified \{ white-space: nowrap; width: 1%; \}/,
  );
  assert(!pageCss.includes(".directory-table th:last-child"));
  assertMatch(
    pageCss,
    /\.directory-table \.directory-name \{ white-space: nowrap; width: 100%; \}/,
  );
  assertMatch(
    pageCss,
    /\.directory-table\[data-hidden-columns~="size"\] \.directory-size/,
  );
});

Deno.test("README selection has case-insensitive deterministic fallback", async () => {
  const f = await fixture({
    "docs/readme.md": "lower",
    "docs/rEaDmE.md": "mixed",
  });
  try {
    const body = await (await handler(f.root))(new Request("http://x/docs/"))
      .then((response) => response.text());
    assertMatch(body, /mixed/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("indexed directories can switch between their index and file listing", async () => {
  const f = await fixture({
    "docs/README.md": "# Docs",
    "docs/note.txt": "note",
    "mixed/rEaDmE.md": "# Mixed",
    "empty/note.txt": "note",
  });
  try {
    const h = await handler(f.root);
    const index = await (await h(
      new Request("http://x/docs/?width=wide&order=size&theme=dark&a=2&a=1"),
    )).text();
    assertMatch(
      index,
      /<a class="raw-link" href="\?raw" title="View raw content \(text\/plain; charset=UTF-8\)" aria-label="View raw content \(text\/plain; charset=UTF-8\)">Raw<\/a><a class="page-action" href="\?download" title="Download file \(text\/markdown; charset=UTF-8\)" aria-label="Download file \(text\/markdown; charset=UTF-8\)">Download<\/a>/,
    );
    assertMatch(
      index,
      /href="\?a=1&amp;a=2&amp;dir&amp;order=size&amp;theme=dark&amp;width=wide" title="Browse directory files"[^>]*>Files/,
    );
    assertMatch(
      index,
      /<a href="\/docs\/\?dir">docs<\/a><span class="breadcrumb-separator" aria-hidden="true">\/<\/span><span aria-current="page">README\.md<\/span>/,
    );
    assertMatch(
      index,
      /<summary><a class="tree-folder-link" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir"[^>]*>Files<\/a><\/summary><ul><li class="tree-entry-row"><a class="active" href="\/docs\/" data-query-remove="dir">README\.md<\/a><a class="tree-files-link" href="\/docs\/\?dir"/,
    );
    assert(!index.includes('<table class="directory-table">'));

    const listing = await (await h(
      new Request(
        "http://x/docs/?width=wide&order=size&dir&raw&theme=dark&a=2&a=1",
      ),
    )).text();
    assertMatch(listing, /<table class="directory-table">/);
    assertMatch(listing, /data-directory-view="true"/);
    assertMatch(
      listing,
      /<summary><a class="active tree-folder-link" href="\/docs\/" data-query-remove="dir">docs\/<\/a><a class="tree-files-link" href="\/docs\/\?dir"[^>]*>Files<\/a><\/summary><ul><li class="tree-entry-row"><a href="\/docs\/" data-query-remove="dir">README\.md<\/a><a class="tree-files-link" href="\/docs\/\?dir"/,
    );
    assertMatch(listing, /<a href="note\.txt">note\.txt<\/a>/);
    assertMatch(
      listing,
      /<nav aria-label="Breadcrumb">[\s\S]*?<\/nav><a class="page-action" href="\?a=1&amp;a=2&amp;order=size&amp;theme=dark&amp;width=wide" data-query-remove="dir" title="View README\.md"[^>]*>README\.md<\/a>/,
    );
    assertMatch(
      listing,
      /href="\?a=1&amp;a=2&amp;dir&amp;order=size-desc&amp;raw&amp;theme=dark&amp;width=wide">Size ↑/,
    );
    assertMatch(
      listing,
      /href="\?a=1&amp;a=2&amp;dir&amp;order=size&amp;raw&amp;theme=dark&amp;width=wide"/,
    );

    const mixed = await (await h(
      new Request("http://x/mixed/?dir"),
    )).text();
    assertMatch(
      mixed,
      /title="View rEaDmE\.md"[^>]*>rEaDmE\.md<\/a>/,
    );
    const mixedIndex = await (await h(new Request("http://x/mixed/"))).text();
    assertMatch(mixedIndex, /aria-current="page">rEaDmE\.md<\/span>/);

    const noIndex = await h(
      new Request("http://x/empty/?dir&order=size"),
    );
    assertEquals(noIndex.status, 302);
    assertEquals(noIndex.headers.get("location"), "/empty/?order=size");
    assertEquals(await noIndex.text(), "Redirecting");
  } finally {
    await f.cleanup();
  }
});

Deno.test("index-less listing URLs remove dir while retaining canonical query state", async () => {
  const f = await fixture({
    "empty/file.txt": "plain",
    "indexed/README.md": "index",
  });
  try {
    const h = await handler(f.root, { redirectStatus: 301 });
    const request = "http://x/empty/?z=last&dir&a=two&a=one&dir";
    const get = await h(new Request(request));
    assertEquals(get.status, 301);
    assertEquals(get.headers.get("location"), "/empty/?a=one&a=two&z=last");
    assertEquals(await get.text(), "Redirecting");

    const head = await h(new Request(request, { method: "HEAD" }));
    assertEquals(head.status, 301);
    assertEquals(head.headers.get("location"), "/empty/?a=one&a=two&z=last");
    assertEquals(await head.text(), "");

    const indexed = await h(
      new Request("http://x/indexed/?dir&order=size"),
    );
    assertEquals(indexed.status, 200);
    assertMatch(await indexed.text(), /<table class="directory-table">/);
  } finally {
    await f.cleanup();
  }
});

Deno.test("listing includes dotfiles and Markdown is sanitized", async () => {
  const f = await fixture({
    "empty/.dot": "x",
    "empty/kib": "x".repeat(1024),
    "raw.md": '<b onclick="bad()">safe</b><script>bad()</script>',
  });
  try {
    const h = await handler(f.root);
    const listing = await h(new Request("http://x/empty/"));
    const listingBody = await listing.text();
    assertMatch(listingBody, /<table class="directory-table">/);
    assertMatch(
      listingBody,
      /<caption class="sr-only">Files at .+empty\/<\/caption>/,
    );
    assertMatch(
      listingBody,
      /<th class="directory-name" scope="col" aria-sort="ascending"><a href="\?order=name-desc">Name ↑<\/a><\/th>/,
    );
    assertMatch(listingBody, /<a href="\.dot">\.dot<\/a>/);
    assertMatch(listingBody, /1K/);
    assert(!listingBody.includes('<h1><a href="/">FILES'));
    const raw = await h(new Request("http://x/raw"));
    const body = await raw.text();
    assertMatch(body, /<b>safe<\/b>/);
    assert(
      !body.includes('onclick="bad()"') && !body.includes("<script>bad()"),
      "sanitizes unsafe HTML",
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("exact text paths render code and raw source accepts queries", async () => {
  const f = await fixture({
    "guide.ts": "const answer: number = 42;\n",
    "data.json": '{"enabled":true}\n',
    ".env": "NAME=value\n",
    "manual.md": "# Guide",
    "blob.bin": "placeholder",
    "applypatch-msg.sample": "#!/bin/sh\necho apply\n",
    ".git/config": "[core]\nrepositoryformatversion = 0\n",
    ".git/hooks/applypatch-msg.sample": "#!/bin/sh\necho apply\n",
    ".gitconfig": "[user]\nname = Example\n",
    ".editorconfig": "root = true\n",
  });
  try {
    await Deno.writeFile(`${f.root}/blob.bin`, new Uint8Array([0, 255]));
    const h = await handler(f.root);
    const guide = await (await h(new Request("http://x/guide.ts?q=1"))).text();
    assertMatch(guide, /code-language">typescript/);
    assertMatch(guide, /token keyword">const/);
    assertMatch(
      guide,
      /href="\?raw" title="View raw content \(text\/plain; charset=UTF-8\)"[^>]*>Raw/,
    );
    assertEquals((await h(new Request("http://x/guide"))).status, 404);
    const hook = await (await h(
      new Request("http://x/applypatch-msg.sample"),
    )).text();
    assertMatch(hook, /code-language">bash/);
    assertMatch(hook, /token builtin class-name">echo/);
    const gitHook = await (await h(
      new Request("http://x/.git/hooks/applypatch-msg.sample"),
    )).text();
    assertMatch(gitHook, /code-language">bash/);
    for (const path of [".git/config", ".gitconfig", ".editorconfig"]) {
      const ini = await (await h(new Request(`http://x/${path}`))).text();
      assertMatch(ini, /code-language">ini/);
      assertMatch(ini, /class="token (?:key|selector)/);
    }
    const json = await (await h(new Request("http://x/data.json"))).text();
    assertMatch(json, /code-language">json/);
    assertMatch(json, /token property/);
    assertMatch(
      await (await h(new Request("http://x/.env"))).text(),
      /NAME=value/,
    );
    const raw = await h(new Request("http://x/guide.ts?raw"));
    assertEquals(raw.headers.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(await raw.text(), "const answer: number = 42;\n");
    const rawHead = await h(
      new Request("http://x/guide.ts?raw", { method: "HEAD" }),
    );
    assertEquals([rawHead.headers.get("content-type"), await rawHead.text()], [
      "text/plain; charset=UTF-8",
      "",
    ]);
    const markdownRaw = await h(new Request("http://x/manual.md?raw"));
    assertEquals(markdownRaw.headers.get("location"), "/manual?raw");
    assertEquals(
      await (await h(new Request("http://x/manual?raw"))).text(),
      "# Guide",
    );
    assertEquals(
      new Uint8Array(
        await (await h(new Request("http://x/blob.bin?raw"))).arrayBuffer(),
      ),
      new Uint8Array([0, 255]),
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("directory Markdown indexes expose raw source", async () => {
  const f = await fixture({ "docs/README.md": "# Docs" });
  try {
    const h = await handler(f.root);
    const rendered = await (await h(new Request("http://x/docs/"))).text();
    assertMatch(
      rendered,
      /href="\?raw" title="View raw content \(text\/plain; charset=UTF-8\)"[^>]*>Raw/,
    );
    const raw = await h(new Request("http://x/docs/?raw"));
    assertEquals(raw.headers.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(await raw.text(), "# Docs");
  } finally {
    await f.cleanup();
  }
});
