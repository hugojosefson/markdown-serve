import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  renderCodeMarkdown,
  renderSourceCodeBlock,
} from "../src/server/render-code-markdown.ts";
import { renderSourceLines } from "../src/server/render-source-lines.ts";

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
  return rendered.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1]
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
