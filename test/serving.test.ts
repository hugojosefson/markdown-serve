import { assertEquals, assertMatch } from "@std/assert";
import { pageScript, pageStylesheet } from "../src/server/page-assets.ts";
import { fixture, handler } from "./fixture.ts";

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
    assertEquals(fontHead.headers.get("content-type"), "font/woff2");
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

Deno.test("text files render only at their exact paths and binaries stay static", async () => {
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
    assertMatch(await editorconfig.text(), /root = true/);
    assertMatch(
      await (await h(new Request("http://x/.gitignore"))).text(),
      /node_modules/,
    );
    assertEquals((await h(new Request("http://x/editorconfig"))).status, 404);
    const binary = await h(new Request("http://x/.binary"));
    assertEquals(
      binary.headers.get("content-type"),
      "application/octet-stream",
    );
    assertEquals(
      new Uint8Array(await binary.arrayBuffer()),
      new Uint8Array([0x61, 0x00, 0xff]),
    );
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
