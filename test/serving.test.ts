import {
  assert,
  assertEquals,
  assertMatch,
  assertNotMatch,
  assertRejects,
} from "@std/assert";
import { pageScript, pageStylesheet } from "../src/server/page-assets.ts";
import { navigationSpeculation } from "../src/server/navigation-speculation.ts";
import { fixture, handler } from "./fixture.ts";
import { join } from "@std/path";

Deno.test("handlers reject missing and non-directory roots", async () => {
  const f = await fixture({ "file.txt": "content" });
  try {
    for (const root of [`${f.root}/missing`, `${f.root}/file.txt`]) {
      await assertRejects(
        () => handler(root),
        Error,
        `cannot access root ${root}:`,
      );
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test({
  name: "permission-denied paths are skipped without repeated warnings",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const f = await fixture({
      "blocked/hidden.ts": "export function hidden() {}",
      "visible.ts": "export function visible() {}",
    });
    const blocked = join(f.root, "blocked");
    const warnings: string[] = [];
    let notify: () => void | Promise<void> = () => {};
    try {
      await Deno.chmod(blocked, 0o000);
      try {
        await Array.fromAsync(Deno.readDir(blocked));
        return;
      } catch (error) {
        if (!(error instanceof Deno.errors.PermissionDenied)) throw error;
      }
      const h = await handler(f.root, {
        reloadSource: {
          subscribe: (listener: () => void | Promise<void>) => (
            notify = listener, () => {}
          ),
        },
        warn: (warning) => warnings.push(warning),
      });
      assertEquals((await h(new Request("http://x/"))).status, 200);
      assertEquals(
        (await h(
          new Request("http://x/__markdown_serve__/files?search=hidden"),
        ))
          .status,
        200,
      );
      assertEquals(
        (await h(new Request("http://x/blocked/hidden.ts"))).status,
        404,
      );
      assertEquals(
        (await h(new Request("http://x/blocked/hidden.ts"))).status,
        404,
      );
      assertEquals((await h(new Request("http://x/visible.ts"))).status, 200);
      await Deno.chmod(blocked, 0o755);
      await notify();
      assertEquals(
        (await h(new Request("http://x/blocked/hidden.ts"))).status,
        200,
      );
      assertEquals(warnings, ["Cannot access blocked: permission denied"]);
    } finally {
      await Deno.chmod(blocked, 0o755);
      await f.cleanup();
    }
  },
});

Deno.test({
  name: "unreadable roots reject handler creation",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const f = await fixture({ "visible.ts": "export const visible = true" });
    try {
      await Deno.chmod(f.root, 0o000);
      try {
        await Array.fromAsync(Deno.readDir(f.root));
        return;
      } catch (error) {
        if (!(error instanceof Deno.errors.PermissionDenied)) throw error;
      }
      await assertRejects(() => handler(f.root), Error, "cannot access root");
    } finally {
      await Deno.chmod(f.root, 0o755);
      await f.cleanup();
    }
  },
});

Deno.test({
  name:
    "unreadable files return 404 once while sibling symbols remain available",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    const f = await fixture({
      "hidden.ts": "export function hidden() {}",
      "visible.ts": "export function visible() {}",
      "consumer.ts": "visible();",
    });
    const hidden = join(f.root, "hidden.ts");
    const warnings: string[] = [];
    try {
      await Deno.chmod(hidden, 0o000);
      try {
        await Deno.readFile(hidden);
        return;
      } catch (error) {
        if (!(error instanceof Deno.errors.PermissionDenied)) throw error;
      }
      const h = await handler(f.root, {
        warn: (warning) => warnings.push(warning),
      });
      assertEquals((await h(new Request("http://x/hidden.ts"))).status, 404);
      assertEquals((await h(new Request("http://x/hidden.ts"))).status, 404);
      assertMatch(
        await (await h(new Request("http://x/consumer.ts"))).text(),
        /href="\/visible\.ts#symbol-visible">visible<\/a>/,
      );
      assertEquals(warnings, ["Cannot access hidden.ts: permission denied"]);
    } finally {
      await Deno.chmod(hidden, 0o644);
      await f.cleanup();
    }
  },
});

Deno.test("source references use unique declarations from the served tree", async () => {
  const f = await fixture({
    "nested/shared.ts": "export function shared() {}\n",
    "nested/consumer.ts": "import { shared } from './shared.ts';\nshared();\n",
    "duplicate-a.ts": "export function duplicate() {}\n",
    "duplicate-b.ts": "export function duplicate() {}\n",
    "ambiguous.ts": "duplicate();\n",
  });
  try {
    const h = await handler(f.root);
    const consumer = await (await h(new Request("http://x/nested/consumer.ts")))
      .text();
    assertMatch(
      consumer,
      /href="\/nested\/shared\.ts#symbol-shared">shared<\/a>/,
    );
    const ambiguous = await (await h(new Request("http://x/ambiguous.ts")))
      .text();
    assertEquals(ambiguous.includes("symbol-duplicate"), false);
  } finally {
    await f.cleanup();
  }
});

Deno.test("static MIME types, HEAD, 404, and 405 responses", async () => {
  const f = await fixture({
    "file.css": "body{}",
    "font.woff2": "font",
    ".hidden": "yes",
  });
  try {
    const h = await handler(f.root);
    const css = await h(new Request("http://x/file.css"));
    assertEquals(css.headers.get("content-type"), "text/html; charset=utf-8");
    assertMatch(await css.text(), /code-language">css/);
    const fontHead = await h(
      new Request("http://x/font.woff2", { method: "HEAD" }),
    );
    assertEquals(
      fontHead.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertEquals(await fontHead.text(), "");
    assertMatch(await (await h(new Request("http://x/.hidden"))).text(), /yes/);
    const missingHead = await h(
      new Request("http://x/missing", { method: "HEAD" }),
    );
    assertEquals([missingHead.status, await missingHead.text()], [404, ""]);
    const post = await h(
      new Request("http://x/file.css", { method: "POST" }),
    );
    assertEquals([post.status, post.headers.get("allow")], [
      405,
      "GET, HEAD",
    ]);
  } finally {
    await f.cleanup();
  }
});

Deno.test("versioned page assets are immutable and external to compact HTML", async () => {
  const f = await fixture({ "guide.md": "guide" });
  try {
    const h = await handler(f.root);
    const page = await (await h(new Request("http://x/guide"))).text();
    assertMatch(page, new RegExp(`href="${pageStylesheet.url}"`));
    assertMatch(page, new RegExp(`src="${pageScript.url}"`));
    assert(page.includes(navigationSpeculation));
    assertEquals(page.includes("<style>"), false);
    assertEquals(page.includes(pageStylesheet.body), false);
    assertEquals(page.includes(pageScript.body), false);
    assertEquals(page.length < 12_000, true);
    for (const asset of [pageStylesheet, pageScript]) {
      const get = await h(new Request(`http://x${asset.url}`));
      assertEquals(get.headers.get("content-type"), asset.contentType);
      assertEquals(
        get.headers.get("cache-control"),
        "public, max-age=31536000, immutable",
      );
      assertEquals(await get.text(), asset.body);
      const head = await h(
        new Request(`http://x${asset.url}`, { method: "HEAD" }),
      );
      assertEquals(head.headers.get("content-type"), asset.contentType);
      assertEquals(await head.text(), "");
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("HEAD generated pages return headers without bodies", async () => {
  const f = await fixture({ "guide.md": "# Guide", "code.ts": "const x = 1" });
  try {
    const h = await handler(f.root);
    for (const path of ["/guide", "/code.ts", "/"]) {
      const response = await h(
        new Request(`http://x${path}`, { method: "HEAD" }),
      );
      assertEquals(
        response.headers.get("content-type"),
        "text/html; charset=utf-8",
      );
      assertEquals(await response.text(), "");
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("file actions have stable placements and preserve raw/download priority", async () => {
  const f = await fixture({
    "guide.md": "# Guide\n\nIntro\n\n## Details\n\n```ts\nconst x = 1;\n```\n",
    "code.ts": "function sourceSymbol() { return 1; }",
    "page.html": "<h1>Page</h1>",
    "photo.png": "",
  });
  try {
    const h = await handler(f.root);
    const rendered = await (await h(new Request("http://x/guide"))).text();
    assertMatch(
      rendered,
      /<header class="content-header">[\s\S]*<nav class="markdown-view-toggle" aria-label="Markdown view"><a class="is-selected" href="\/guide" aria-current="true">Rendered<\/a><a class="" href="\?source">Source<\/a><\/nav><div class="file-actions"><a class="file-action raw-link" href="\?raw"[^>]*>Raw<\/a><a class="file-action download-link" href="\?download"[^>]*>Download<\/a><\/div>[\s\S]*<\/header>/,
    );
    assertEquals(
      rendered.match(/<header class="content-header[^>]*>[\s\S]*?<\/header>/)
        ?.[0].includes("Raw") ||
        rendered.match(/<header class="content-header[^>]*>[\s\S]*?<\/header>/)
          ?.[0].includes("Download"),
      true,
    );
    assertMatch(rendered, /<details class="markdown-toc" open>/);
    assertMatch(
      pageStylesheet.body,
      /\.markdown-body \.file-action \{[^}]*color: var\(--code-muted\)/,
    );
    assertEquals(rendered.includes('href="#L1"'), false);
    const source = await (await h(
      new Request("http://x/guide?source&theme=dark"),
    )).text();
    assertMatch(source, /id="L1"/);
    assertMatch(source, /href="#guide" id="guide">Guide<\/a>/);
    assertNotMatch(source, /<h1 id="guide"|markdown-toc/);
    assertMatch(
      source,
      /<header class="content-header">[\s\S]*<nav class="markdown-view-toggle" aria-label="Markdown view"><a class="" href="\?theme=dark">Rendered<\/a><a class="is-selected" href="\?source&amp;theme=dark" aria-current="true">Source<\/a><\/nav><div class="file-actions"><a class="file-action raw-link" href="\?raw"[^>]*>Raw<\/a><a class="file-action download-link" href="\?download"[^>]*>Download<\/a><\/div>[\s\S]*<\/header><section class="markdown-source-panel" aria-label="Markdown source"><div class="code-block">/,
    );
    const sourceWithMetadata = await (await h(
      new Request("http://x/guide?metadata&source"),
    )).text();
    assertMatch(
      sourceWithMetadata,
      /<\/header><section class="file-metadata-details"[\s\S]*?<\/section><section class="markdown-source-panel" aria-label="Markdown source">/,
    );
    assertMatch(
      await (await h(new Request("http://x/guide?source&raw"))).text(),
      /# Guide/,
    );
    assertMatch(
      (await h(new Request("http://x/guide?source&download"))).headers.get(
        "content-disposition",
      )!,
      /^attachment; filename="guide\.md"/,
    );
    const text = await (await h(new Request("http://x/code.ts"))).text();
    assertMatch(text, /id="symbol-sourceSymbol"/);
    assertMatch(
      text,
      /source-symbol-marker" href="#symbol-sourceSymbol" aria-label="Go to sourceSymbol declaration on line 1"/,
    );
    assertMatch(
      text,
      /Copy<\/button><span class="code-toolbar-file-actions" data-file-actions="trailing"><a class="file-action raw-link" href="\?raw"[^>]*>Raw<\/a><a class="file-action download-link" href="\?download"[^>]*>Download<\/a>/,
    );
    const html = await (await h(new Request("http://x/page.html"))).text();
    assertMatch(
      html,
      /<span class="code-toolbar-file-actions" data-file-actions="leading"><a class="file-action" href="\/__markdown_serve__\/site\/page\.html" target="_blank" rel="noopener"[^>]*>View page<\/a><\/span><button class="code-copy"/,
    );
    assertNotMatch(
      html.match(/<header class="content-header[^>]*>[\s\S]*?<\/header>/)
        ?.[0] ?? "",
      /Raw|Download|View page/,
    );
    const media = await (await h(new Request("http://x/photo.png"))).text();
    assertMatch(
      media,
      /<div class="page-content page-content-top"><div class="file-actions file-actions-top"><a class="file-action raw-link" href="\?raw"[^>]*>Raw<\/a><a class="file-action download-link" href="\?download"[^>]*>Download<\/a>/,
    );
    const directoryFixture = await fixture({ "docs/README.md": "# Docs" });
    try {
      const directoryHandler = await handler(directoryFixture.root);
      const indexed =
        await (await directoryHandler(new Request("http://x/docs/"))).text();
      const header =
        indexed.match(/<header class="content-header[^>]*>[\s\S]*?<\/header>/)
          ?.[0] ?? "";
      assertMatch(header, /Files/);
      assertMatch(header, /Raw.*Download/);
      const listing =
        await (await directoryHandler(new Request("http://x/docs/\?dir")))
          .text();
      assertMatch(
        listing.match(/<header class="content-header[^>]*>[\s\S]*?<\/header>/)
          ?.[0] ?? "",
        /README\.md/,
      );
    } finally {
      await directoryFixture.cleanup();
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("Markdown edit view owns the content area and shares source styling", async () => {
  const f = await fixture({
    "guide.md": "# Guide\n\nRendered paragraph.\n",
  });
  try {
    const h = await handler(f.root, { edit: true });
    const edit = await (await h(
      new Request("http://x/guide?edit&metadata&theme=dark&wide"),
    )).text();
    assertMatch(
      edit,
      /aria-label="Markdown view"><a[^>]*>Rendered<\/a><a[^>]*>Source<\/a><a class="is-selected"[^>]*>Edit<\/a>/,
    );
    assertMatch(
      edit,
      /<section class="markdown-source-panel markdown-edit-panel"[\s\S]*<textarea class="edit-text"[^>]*># Guide\n\nRendered paragraph\.\n<\/textarea>/,
    );
    assertEquals(edit.includes("markdown-toc"), false);
    assertEquals(
      edit.includes('<section class="file-metadata-details"'),
      false,
    );
    assertMatch(
      edit,
      /class="edit-markdown-preview"[\s\S]*<h1 id="guide"/,
    );
    assertMatch(
      edit,
      /class="edit-highlight code-block gfm-highlight"[\s\S]*class="token/,
    );

    const source = await (await h(new Request("http://x/guide?source"))).text();
    assertMatch(source, /class="markdown-source-panel"/);
    assertMatch(source, /id="L1"/);
    assertMatch(
      source,
      />Rendered<\/a><a class="is-selected"[^>]*>Source<\/a><a[^>]*>Edit<\/a>/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("site previews serve scoped assets and safely resolve directories", async () => {
  const f = await fixture({
    "site/index.html":
      '<link rel="stylesheet" href="style.css"><script src="app.js"></script>',
    "site/style.css": "body { color: red; }",
    "site/app.js": "window.ok = true;",
    "site/image.png": "image",
  });
  try {
    const h = await handler(f.root);
    const base = "http://x/__markdown_serve__/site/site";
    const redirect = await h(new Request(base));
    assertEquals([redirect.status, redirect.headers.get("location")], [
      302,
      "/__markdown_serve__/site/site/",
    ]);
    const page = await h(new Request(`${base}/`));
    assertEquals(page.headers.get("content-type"), "text/html; charset=UTF-8");
    assertMatch(await page.text(), /style\.css/);
    assertEquals(
      page.headers.get("content-security-policy"),
      "sandbox allow-scripts; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    );
    for (
      const [path, type, body] of [
        ["style.css", "text/css; charset=UTF-8", "body { color: red; }"],
        [
          "app.js",
          "text/javascript; charset=UTF-8",
          "window.ok = true;",
        ],
        ["image.png", "image/png", "image"],
      ]
    ) {
      const response = await h(new Request(`${base}/${path}`));
      assertEquals(response.headers.get("content-type"), type);
      assertEquals(await response.text(), body);
    }
    const head = await h(new Request(`${base}/style.css`, { method: "HEAD" }));
    assertEquals(await head.text(), "");
    assertEquals((await h(new Request(`${base}/missing`))).status, 404);
    assertEquals(
      (await h(new Request("http://x/__markdown_serve__/site/%2e%2e%2fsafe")))
        .status,
      400,
    );
    const post = await h(new Request(`${base}/`, { method: "POST" }));
    assertEquals([post.status, post.headers.get("allow")], [405, "GET, HEAD"]);
    assertEquals(
      (await h(new Request("http://x/__markdown_serve__/site/"))).status,
      404,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("text files render only at their exact paths and binaries render pages", async () => {
  const f = await fixture({
    ".editorconfig": "root = true\n# café\n",
    ".gitignore": "node_modules/\n",
    ".binary": "placeholder",
  });
  try {
    await Deno.writeFile(
      `${f.root}/.binary`,
      new Uint8Array([0x61, 0x00, 0xff]),
    );
    await Deno.writeFile(`${f.root}/image.png`, new Uint8Array([0, 255]));
    const h = await handler(f.root);
    const editorconfig = await h(new Request("http://x/.editorconfig"));
    assertEquals(
      editorconfig.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertMatch(
      await editorconfig.text(),
      /token key attr-name">root.*token value attr-value">true/s,
    );
    assertMatch(
      await (await h(new Request("http://x/.gitignore"))).text(),
      /node_modules/,
    );
    assertEquals((await h(new Request("http://x/editorconfig"))).status, 404);
    const binary = await h(new Request("http://x/.binary"));
    assertEquals(
      binary.headers.get("content-type"),
      "text/html; charset=utf-8",
    );
    assertMatch(await binary.text(), /00000000\s+61 00 ff.*\|a\.\.\|/s);
    for (const path of ["/.binary", "/image.png"]) {
      const get = await h(new Request(`http://x${path}`));
      const head = await h(new Request(`http://x${path}`, { method: "HEAD" }));
      assertEquals(
        head.headers.get("content-type"),
        get.headers.get("content-type"),
      );
      assertEquals(await head.text(), "");
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("file pages expose metadata, previews, raw downloads, and ranges", async () => {
  const f = await fixture({
    "photo.png": "",
    "song.mp3": "x",
    "movie.mp4": "x",
    "paper.pdf": "x",
    "vector.svg": '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    "script.ts": "const value = 1;",
    "empty.bin": "",
    "café.bin": "x",
  });
  try {
    await Deno.writeFile(`${f.root}/photo.png`, new Uint8Array([1, 2, 3, 4]));
    const h = await handler(f.root);
    const image = await (await h(new Request("http://x/photo.png"))).text();
    assertMatch(
      image,
      /<a class="file-metadata" href="\?metadata" title="Expand metadata" aria-label="Expand metadata" aria-controls="file-metadata-details" aria-expanded="false">4 B <span[^>]*>·<\/span> <span class="file-metadata-relative" data-relative-time="[^"]+">(?:now|today)<\/span><\/a>/,
    );
    assert(!image.includes('<section class="file-metadata-details"'));
    assertMatch(
      pageStylesheet.body,
      /\.content-header \.file-metadata > span\[aria-hidden="true"\] \{ color: var\(--code-border\); \}/,
    );
    const details = await (await h(
      new Request("http://x/photo.png?metadata"),
    )).text();
    assertMatch(
      details,
      /<\/header><section class="file-metadata-details" id="file-metadata-details" aria-label="File metadata"><div class="file-metadata-details-header"><span>File metadata<\/span><a class="file-metadata-close" href="\/photo\.png" title="Collapse metadata" aria-label="Collapse metadata"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8"\/><\/svg><\/a><\/div><dl>.*<dt>Modified<\/dt><dd><time datetime="[^"]+" aria-label="[^"]+">.*class="timestamp-separator timestamp-t">T<\/span>.*class="timestamp-separator timestamp-zone">Z<\/span><\/time><wbr> <span class="metadata-value-suffix">\(<span class="metadata-relative-time" data-relative-time="[^"]+">(?:now|today)<\/span>\)<\/span><\/dd>.*<dt>Size<\/dt><dd>4 bytes<\/dd>.*<dt>Media type<\/dt><dd>image\/png<\/dd>.*<dt>User<\/dt>.*<dt>Permissions<\/dt>.*<dt>Mode<\/dt>.*<\/dl><\/section><div class="page-content/s,
    );
    assertMatch(
      details,
      /<header class="content-header metadata-expanded">.*<a class="file-metadata" href="\/photo\.png" title="Collapse metadata" aria-label="Collapse metadata" aria-controls="file-metadata-details" aria-expanded="true">4 B <span[^>]*>·<\/span> <span class="file-metadata-relative" data-relative-time="[^"]+">(?:now|today)<\/span><\/a>/s,
    );
    assertMatch(
      pageStylesheet.body,
      /\.content-header\.metadata-expanded \.file-metadata \{ background: var\(--code-hover\); border-color: var\(--code-border\); color: var\(--focus-color\); \}.*\.markdown-body \.file-metadata-details \{[^}]*margin: 14px 0 16px;[^}]*overflow: hidden; padding: 0;/s,
    );
    const themedDetails = await (await h(
      new Request("http://x/photo.png?theme=dark&metadata&wide"),
    )).text();
    assertMatch(
      themedDetails,
      /<a class="file-metadata" href="\?theme=dark&amp;wide" title="Collapse metadata" aria-label="Collapse metadata" aria-controls="file-metadata-details" aria-expanded="true">/,
    );
    assertMatch(
      themedDetails,
      /<a class="file-metadata-close" href="\?theme=dark&amp;wide" title="Collapse metadata" aria-label="Collapse metadata">/,
    );
    assertMatch(
      image,
      /<a class="file-action raw-link" href="\?raw" title="View raw content \(image\/png\)" aria-label="View raw content \(image\/png\)">Raw<\/a><a class="file-action download-link" href="\?download" title="Download file \(image\/png\)" aria-label="Download file \(image\/png\)">Download<\/a>/,
    );
    assertMatch(
      image,
      /<img class="media-preview image"[^>]+alt="photo\.png">/,
    );
    assert(!image.includes("onload="));
    assertMatch(pageScript.body, /naturalWidth \* 4/);
    assertMatch(
      pageStylesheet.body,
      /\.media-preview\.pdf \{[^}]*height: calc\(100dvh - 8rem\);[^}]*min-height: 20rem;/,
    );
    assertNotMatch(pageStylesheet.body, /\.media-preview\.pdf[^}]*900px/);
    assertMatch(
      await (await h(new Request("http://x/vector.svg"))).text(),
      /<img class="media-preview image"/,
    );
    const rawSvg = await h(new Request("http://x/vector.svg?raw"));
    assertEquals(rawSvg.headers.get("x-content-type-options"), "nosniff");
    assertMatch(
      rawSvg.headers.get("content-security-policy")!,
      /sandbox; default-src 'none'/,
    );
    assertMatch(
      await (await h(new Request("http://x/script.ts"))).text(),
      /code-language">typescript/,
    );
    for (
      const [path, shape] of [
        ["/paper.pdf", /<embed/],
        ["/song.mp3", /<audio/],
        ["/movie.mp4", /<video/],
      ] as const
    ) {
      assertMatch(
        await (await h(new Request(`http://x${path}`))).text(),
        shape,
      );
    }
    const raw = await h(
      new Request("http://x/photo.png?raw", {
        headers: { Range: "bytes=1-2" },
      }),
    );
    assertEquals([
      raw.status,
      raw.headers.get("content-type"),
      raw.headers.get("content-range"),
    ], [206, "image/png", "bytes 1-2/4"]);
    assertEquals(
      new Uint8Array(await raw.arrayBuffer()),
      new Uint8Array([2, 3]),
    );
    const suffix = await h(
      new Request("http://x/photo.png?raw", {
        headers: { Range: "bytes=-2" },
      }),
    );
    assertEquals(
      [suffix.status, suffix.headers.get("content-range")],
      [206, "bytes 2-3/4"],
    );
    assertEquals(
      new Uint8Array(await suffix.arrayBuffer()),
      new Uint8Array([3, 4]),
    );
    const textRange = await h(
      new Request("http://x/script.ts?raw", {
        headers: { Range: "bytes=0-4" },
      }),
    );
    assertEquals(
      [textRange.status, textRange.headers.get("content-range")],
      [206, "bytes 0-4/16"],
    );
    assertEquals(await textRange.text(), "const");
    for (const value of ["bytes=-0", "bytes=4-5", "bytes=3-2"]) {
      const invalid = await h(
        new Request("http://x/photo.png?raw", { headers: { Range: value } }),
      );
      assertEquals(invalid.status, 416);
      assertEquals(invalid.headers.get("content-range"), "bytes */4");
    }
    const empty = await h(new Request("http://x/empty.bin?raw"));
    assertEquals([empty.status, empty.headers.get("content-length")], [
      200,
      "0",
    ]);
    assertEquals((await empty.arrayBuffer()).byteLength, 0);
    const download = await h(new Request("http://x/photo.png?download"));
    assertMatch(
      download.headers.get("content-disposition")!,
      /attachment; filename="photo.png"/,
    );
    assertMatch(
      (await h(new Request("http://x/caf%C3%A9.bin?download"))).headers.get(
        "content-disposition",
      )!,
      /filename="caf_\.bin"; filename\*=UTF-8''caf%C3%A9\.bin/,
    );
    const head = await h(
      new Request("http://x/photo.png?raw", { method: "HEAD" }),
    );
    assertEquals([head.headers.get("content-type"), await head.text()], [
      "image/png",
      "",
    ]);
  } finally {
    await f.cleanup();
  }
});

Deno.test("malformed and traversal-style paths are rejected", async () => {
  const f = await fixture({ "safe.txt": "safe" });
  try {
    const h = await handler(f.root);
    for (
      const path of [
        "/%zz",
        "/%00",
        "/%2e%2e%2fsafe.txt",
        "/safe%2ftxt",
        "/safe%5ctxt",
      ]
    ) {
      assertEquals((await h(new Request(`http://x${path}`))).status, 400, path);
    }
    assertEquals(
      (await h(new Request("http://x/missing/child"))).status,
      404,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("symlink targets are followed for files, directories, indexes, and listings", async () => {
  if (Deno.build.os === "windows") {
    return;
  }
  const f = await fixture({
    "target/file.txt": "linked",
    "target/README.md": "linked index",
    "index-links/.keep": "",
  });
  try {
    await Deno.symlink(`${f.root}/target/file.txt`, `${f.root}/linked.txt`);
    await Deno.symlink(`${f.root}/target`, `${f.root}/linked-dir`);
    await Deno.symlink(`${f.root}/target`, `${f.root}/index-dir`);
    await Deno.symlink(
      `${f.root}/target/README.md`,
      `${f.root}/index-links/README.md`,
    );
    const h = await handler(f.root);
    assertMatch(
      await (await h(new Request("http://x/linked.txt"))).text(),
      /linked/,
    );
    const linkedRedirect = await h(new Request("http://x/linked-dir"));
    assertEquals(linkedRedirect.headers.get("location"), "/linked-dir/");
    const linkedDirectory = await h(new Request("http://x/linked-dir/"));
    assertMatch(await linkedDirectory.text(), /linked index/);
    const linkedIndex = await h(new Request("http://x/index-links/"));
    assertMatch(await linkedIndex.text(), /linked index/);
    const root = await h(new Request("http://x/"));
    assertMatch(await root.text(), /index-dir\//);
  } finally {
    await f.cleanup();
  }
});

Deno.test("symlinks may target paths outside the logical root", async () => {
  if (Deno.build.os === "windows") {
    return;
  }
  const f = await fixture({});
  const outside = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${outside}/outside.txt`, "outside");
    await Deno.symlink(`${outside}/outside.txt`, `${f.root}/outside.txt`);
    assertMatch(
      await (await handler(f.root))(new Request("http://x/outside.txt")).then((
        response,
      ) => response.text()),
      /outside/,
    );
  } finally {
    await Deno.remove(outside, { recursive: true });
    await f.cleanup();
  }
});
