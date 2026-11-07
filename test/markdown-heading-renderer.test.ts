import { assertEquals, assertMatch } from "@std/assert";
import { renderCodeMarkdown } from "../src/server/render-code-markdown.ts";
import { renderMarkdownToc } from "../src/server/markdown-toc.ts";

Deno.test("Markdown headings and internal links use ASCII fragments", () => {
  const html = renderMarkdownToc(renderCodeMarkdown(
    [
      "# Å ä ö",
      "[Raw](#å-ä-ö) [Encoded](#%C3%A5-%C3%A4-%C3%B6)",
      "## 中文",
      "## Café",
      "## Cafe\u0301",
    ].join("\n\n"),
    "http://x/",
  ));
  const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((match) =>
    match[1]
  );
  assertEquals(ids, ["a-a-o", "u4e2du6587", "cafe", "cafe-1"]);
  for (const id of ids) {
    assertMatch(id, /^[a-z0-9_-]+$/);
    assertMatch(html, new RegExp(`href="#${id}"`));
  }
  assertMatch(html, /href="#a-a-o">Raw<\/a>/);
  assertMatch(html, /href="#a-a-o">Encoded<\/a>/);
  assertMatch(html, /href="#a-a-o">Å ä ö<\/a>/);
});

Deno.test("Markdown fragments stay unique after accent removal", () => {
  const html = renderMarkdownToc(renderCodeMarkdown(
    [
      "# A",
      "# Å",
      "# A-1",
      "# Å",
      "[First](#a) [Second](#å) [Third](#a-1) [Fourth](#å-1)",
    ].join("\n\n"),
    "http://x/",
  ));
  const ids = [...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((match) =>
    match[1]
  );
  assertEquals(ids, ["a", "a-1", "a-1-1", "a-1-2"]);
  for (
    const [index, label] of ["First", "Second", "Third", "Fourth"].entries()
  ) {
    assertMatch(html, new RegExp(`href="#${ids[index]}">${label}</a>`));
  }
});

Deno.test("Markdown fragment changes preserve code and other links", () => {
  const html = renderCodeMarkdown(
    [
      "# Å",
      '`href="#å"`',
      '`<a href="#å">`',
      "[Other](#unknown) [Malformed](#%zz) [External](https://example.com/#å)",
    ].join("\n\n"),
    "http://x/",
  );
  assertMatch(html, /<code>href="#å"<\/code>/);
  assertMatch(html, /<code>&lt;a href="#å"&gt;<\/code>/);
  assertMatch(html, /href="#unknown"/);
  assertMatch(html, /href="#%zz"/);
  assertMatch(html, /href="https:\/\/example.com\/#%C3%A5"/);
});
