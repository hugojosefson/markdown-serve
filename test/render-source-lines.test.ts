import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  renderCodeMarkdown,
  renderSourceCodeBlock,
  renderSourceCodeBlockWithSymbols,
} from "../src/server/render-code-markdown.ts";
import { renderSourceLines } from "../src/server/render-source-lines.ts";
import { pageCss } from "../src/server/page-css.ts";

Deno.test("source lines add accessible links without adding numbers to code text", () => {
  const rendered = renderSourceLines("one\ntwo\n");
  assertMatch(
    rendered,
    /<span class="source-line" id="L1"><a class="source-line-number" href="#L1" aria-label="Line 1" data-line="1"><\/a><span class="source-line-content">one<\/span><\/span>/,
  );
  assertMatch(rendered, /id="L3"[^>]*>.*data-line="3"/s);
  assertMatch(
    rendered,
    /<\/span><\/span><span class="source-line-break" aria-hidden="true">\n<\/span><span class="source-line"/,
  );
  assertEquals(rendered.replaceAll(/<[^>]+>/g, ""), "one\ntwo\n");
});

Deno.test("source symbols preserve escaped and non-ASCII source offsets", async () => {
  const rendered = await renderSourceCodeBlockWithSymbols(
    'const café = "<tag>";\nfunction greet() { return greet; }',
    "typescript",
  );
  assertMatch(rendered, /id="symbol-greet"/);
  assertMatch(rendered, /href="#symbol-greet"/);
  assertMatch(
    rendered,
    /source-symbol-marker" href="#symbol-greet" aria-label="Go to greet declaration on line 2"/,
  );
  assert(rendered.includes("&lt;tag>"));
  assertEquals(
    sourceText(rendered),
    'const café = "<tag>";\nfunction greet() { return greet; }',
  );
});

Deno.test("symbol targets scroll back to attached comments without moving the target", async () => {
  const rendered = await renderSourceCodeBlockWithSymbols(
    "/** café docs */\nfunction greet() {}",
    "typescript",
  );
  assertMatch(
    rendered,
    /class="symbol-link symbol-declaration" href="#symbol-greet" id="symbol-greet" style="--attached-comment-lines:1">greet<\/a>/,
  );
  assertMatch(
    pageCss,
    /\.source-line:has\([^)]*\.symbol-declaration:target[^)]*\)[^{]*\{ background: var\(--code-hover\); \}/,
  );
  assertEquals(sourceText(rendered), "/** café docs */\nfunction greet() {}");
});

Deno.test("duplicate symbol line targets retain attached comment offsets", async () => {
  const rendered = await renderSourceCodeBlockWithSymbols(
    "// First\nfunction same() {}\n// Second\nfunction same() {}",
    "javascript",
  );
  assertMatch(
    rendered,
    /source-line source-symbol-gutter source-line-symbol" id="L2" style="--attached-comment-lines:1"/,
  );
  assertMatch(rendered, /symbol-declaration" href="#L2"/);
});

Deno.test("source lines retain Prism tokens that cross a newline", () => {
  const rendered = renderSourceCodeBlock(
    "/* first\nsecond */\n<script>",
    "typescript",
  );
  assertMatch(
    rendered,
    /source-line-content"><span class="token comment">\/\* first<\/span><\/span><\/span><span class="source-line-break" aria-hidden="true">\n<\/span><span class="source-line" id="L2">.*<span class="token comment">second \*\//s,
  );
  assertEquals(
    sourceText(rendered),
    "/* first\nsecond */\n<script>",
  );
  assert(rendered.includes("&lt;"));
});

Deno.test("normal Markdown fenced code keeps its existing non-anchor markup", () => {
  const rendered = renderCodeMarkdown(
    "```ts\nconst value = 1;\n```",
    "http://x/",
  );
  assertEquals(rendered.includes('href="#L1"'), false);
  assertEquals(rendered.includes("symbol-declaration"), false);
});

Deno.test("Markdown source headings use the rendered GFM fragments", async () => {
  const markdown = [
    "# Hello, *world*!",
    "Café 中文 🔥",
    "---",
    "> - ### [linked](path) `code`",
    "# Hello, *world*!",
    "# Ship :rocket:",
    "```md",
    "# not a heading",
    "```",
  ].join("\n");
  const source = await renderSourceCodeBlockWithSymbols(markdown, "markdown");
  const rendered = renderCodeMarkdown(markdown, "http://x/");
  const ids = [...rendered.matchAll(/<h[1-6] id="([^"]+)"/g)].map((match) =>
    match[1]
  );
  assertEquals(ids, [
    "hello-world",
    "café-中文-",
    "linkedpath-code",
    "hello-world-1",
    "ship-",
  ]);
  for (const id of ids) {
    assertMatch(source, new RegExp(`href="#${id}"`));
    assertMatch(source, new RegExp(`id="${id}"`));
  }
  assertEquals(source.includes("not-a-heading"), false);
  assertEquals(sourceText(source), markdown);
});

Deno.test("Markdown source headings ignore raw HTML and map multiline Setext starts", async () => {
  const markdown = [
    '<h2 id="raw-heading"><a class="anchor">Raw</a></h2>',
    "",
    "first",
    "second",
    "---",
    "# Real heading",
  ].join("\n");
  const source = await renderSourceCodeBlockWithSymbols(markdown, "markdown");
  assertEquals(source.includes('id="raw-heading"'), false);
  assertMatch(
    source,
    /id="L3"[^>]*>.*id="firstsecond"[^>]*>first<\/a>/s,
  );
  assertMatch(source, /id="real-heading"/);
  assertEquals(sourceText(source), markdown);
});

Deno.test("non-Markdown source formats do not create heading fragments", async () => {
  for (const language of ["css", "markup", "json", "yaml", "toml", "ini"]) {
    const source = await renderSourceCodeBlockWithSymbols(
      "# Heading\n---",
      language,
    );
    assertEquals(source.includes("source-heading"), false, language);
    assertEquals(source.includes('href="#heading"'), false, language);
  }
});

Deno.test("Markdown heading analysis failures preserve source rendering", async () => {
  const markdown = "Text[^1]\n\n[^1]:\n    # Footnote heading\n";
  const source = await renderSourceCodeBlockWithSymbols(markdown, "markdown");
  assertEquals(sourceText(source), markdown);
});

Deno.test("source lines expose Git markers and deletion labels without changing source text", () => {
  const rendered = renderSourceCodeBlock(
    "one\ntwo",
    "text",
    new Map([
      [1, { staged: true, unstaged: true, deletions: 2 }],
      [2, { unstaged: true }],
    ]),
  );
  assertMatch(rendered, /source-line-both" id="L1" data-git-change="both"/);
  assertMatch(
    rendered,
    /aria-label="Line 1, staged and unstaged change, 2 deleted lines" data-line="1"><span class="source-line-deletions" data-deletions="2" aria-hidden="true"/,
  );
  assertMatch(
    rendered,
    /source-line-unstaged" id="L2" data-git-change="unstaged"/,
  );
  assertEquals(sourceText(rendered), "one\ntwo");
});

function sourceText(rendered: string): string | undefined {
  const text = rendered.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1]
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
  return text?.replaceAll(
    /&#x([0-9a-f]+);/gi,
    (_, value) => String.fromCodePoint(Number.parseInt(value, 16)),
  );
}
