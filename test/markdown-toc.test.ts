import { assert, assertEquals, assertMatch } from "@std/assert";
import { renderCodeMarkdown } from "../src/server/render-code-markdown.ts";
import { renderMarkdownToc } from "../src/server/markdown-toc.ts";
import { pageStylesheet } from "../src/server/page-assets.ts";

Deno.test("Markdown ToC uses sanitized GFM heading IDs and readable labels", () => {
  const rendered = renderMarkdownToc(
    renderCodeMarkdown("# A &amp; *B*\n\nText\n\n## `C`", "http://x/"),
  );
  assertMatch(rendered, /<details class="markdown-toc" open>/);
  assertMatch(rendered, /<nav aria-label="Table of contents">/);
  assertMatch(rendered, /href="#a-amp-b">A &amp; B<\/a>/);
  assertMatch(rendered, /href="#c">C<\/a>/);
  assert(!rendered.includes('href="#a-b"'));
});

Deno.test("Markdown ToC opens after the initial heading block only", () => {
  const toc = (markdown: string) =>
    renderMarkdownToc(
      renderCodeMarkdown(markdown, "http://x/"),
    );
  assertMatch(toc("# T\n## S"), /<details class="markdown-toc">/);
  assertMatch(
    toc("# T\n\ntext\n\n## S"),
    /<details class="markdown-toc" open>/,
  );
  assertMatch(toc("text\n\n## S"), /<details class="markdown-toc" open>/);
  assertEquals(toc("text"), renderCodeMarkdown("text", "http://x/"));
});

Deno.test("Markdown ToC follows the initial contiguous heading block", () => {
  const rendered = renderMarkdownToc(
    renderCodeMarkdown("# Title\n## Summary\n\nText\n\n### Later", "http://x/"),
  );
  assertMatch(
    rendered,
    /<h1 id="title">[\s\S]*?<\/h1>\s*<h2 id="summary">[\s\S]*?<\/h2><details class="markdown-toc" open>/,
  );
  const withoutInitialBlock = renderMarkdownToc(
    renderCodeMarkdown("Text\n\n## Heading", "http://x/"),
  );
  assertMatch(withoutInitialBlock, /^<details class="markdown-toc" open>/);
});

Deno.test("Markdown ToC preserves sanitized heading entities", () => {
  const rendered = renderMarkdownToc(
    '<h2 id="fire"><a class="anchor" href="#fire"></a>&#x1F525; &copy; <img alt="icon &amp; label"></h2>',
  );
  assertMatch(rendered, /href="#fire">&#x1F525; &copy; icon &amp; label<\/a>/);
});

Deno.test("Markdown ToC floats on larger screens and stacks on small screens", () => {
  assertMatch(
    pageStylesheet.body,
    /\.markdown-toc \{[^}]*float: right;[^}]*margin: 0 0 1rem 1\.5rem;[^}]*max-width: min\(20rem, 45%\)/,
  );
  assertMatch(
    pageStylesheet.body,
    /@media \(max-width: 800px\) \{ \.markdown-toc \{ float: none; margin: 0 0 1rem; max-width: none; \} \}/,
  );
});
