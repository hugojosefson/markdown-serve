import { assert, assertEquals, assertMatch } from "@std/assert";
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

Deno.test("listing includes dotfiles and Markdown is sanitized", async () => {
  const f = await fixture({
    "empty/.dot": "x",
    "raw.md": '<b onclick="bad()">safe</b><script>bad()</script>',
  });
  try {
    const h = await handler(f.root);
    const listing = await h(new Request("http://x/empty/"));
    assertMatch(await listing.text(), /\.dot/);
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

Deno.test("exact text paths render code and raw source preserves queries", async () => {
  const f = await fixture({
    "guide.ts": "const answer: number = 42;\n",
    "data.json": '{"enabled":true}\n',
    ".env": "NAME=value\n",
    "manual.md": "# Guide",
    "blob.bin": "placeholder",
  });
  try {
    await Deno.writeFile(`${f.root}/blob.bin`, new Uint8Array([0, 255]));
    const h = await handler(f.root);
    const guide = await (await h(new Request("http://x/guide.ts?q=1"))).text();
    assertMatch(guide, /code-language">typescript/);
    assertMatch(guide, /token keyword">const/);
    assertMatch(guide, /href="\?q=1&amp;raw">Raw/);
    assertEquals((await h(new Request("http://x/guide"))).status, 404);
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
    assertMatch(rendered, /href="\?raw">Raw/);
    const raw = await h(new Request("http://x/docs/?raw"));
    assertEquals(raw.headers.get("content-type"), "text/plain; charset=UTF-8");
    assertEquals(await raw.text(), "# Docs");
  } finally {
    await f.cleanup();
  }
});
