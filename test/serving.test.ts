import { assertEquals, assertMatch } from "@std/assert";
import { fixture, handler } from "./fixture.ts";

Deno.test("static MIME types, HEAD, 404, and 405 responses", async () => {
  const f = await fixture({
    "file.css": "body{}",
    "font.woff2": "font",
    ".hidden": "yes",
  });
  try {
    const h = await handler(f.root);
    let response = await h(new Request("http://x/file.css"));
    assertEquals(
      response.headers.get("content-type"),
      "text/css; charset=UTF-8",
    );
    assertEquals(await response.text(), "body{}");
    response = await h(new Request("http://x/font.woff2", { method: "HEAD" }));
    assertEquals(response.headers.get("content-type"), "font/woff2");
    assertEquals(await response.text(), "");
    assertEquals(
      await (await h(new Request("http://x/.hidden"))).text(),
      "yes",
    );
    response = await h(new Request("http://x/missing", { method: "HEAD" }));
    assertEquals([response.status, await response.text()], [404, ""]);
    response = await h(new Request("http://x/file.css", { method: "POST" }));
    assertEquals([response.status, response.headers.get("allow")], [
      405,
      "GET, HEAD",
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
  } finally {
    await f.cleanup();
  }
});

Deno.test("symlink targets are followed for files, directories, indexes, and listings", async () => {
  if (Deno.build.os === "windows") return;
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
    assertEquals(
      await (await h(new Request("http://x/linked.txt"))).text(),
      "linked",
    );
    let response = await h(new Request("http://x/linked-dir"));
    assertEquals(response.headers.get("location"), "/linked-dir/");
    response = await h(new Request("http://x/linked-dir/"));
    assertMatch(await response.text(), /linked index/);
    response = await h(new Request("http://x/index-links/"));
    assertMatch(await response.text(), /linked index/);
    response = await h(new Request("http://x/"));
    assertMatch(await response.text(), /index-dir\//);
  } finally {
    await f.cleanup();
  }
});

Deno.test("symlinks may target paths outside the logical root", async () => {
  if (Deno.build.os === "windows") return;
  const f = await fixture({});
  const outside = await Deno.makeTempDir();
  try {
    await Deno.writeTextFile(`${outside}/outside.txt`, "outside");
    await Deno.symlink(`${outside}/outside.txt`, `${f.root}/outside.txt`);
    assertEquals(
      await (await handler(f.root))(new Request("http://x/outside.txt")).then((
        response,
      ) => response.text()),
      "outside",
    );
  } finally {
    await Deno.remove(outside, { recursive: true });
    await f.cleanup();
  }
});
