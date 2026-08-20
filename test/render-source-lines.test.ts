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
  assertEquals(rendered.replaceAll(/<[^>]+>/g, ""), "one\ntwo\n");
});

Deno.test("source lines retain Prism tokens that cross a newline", () => {
  const rendered = renderSourceCodeBlock(
    "/* first\nsecond */\n<script>",
    "typescript",
  );
  assertMatch(
    rendered,
    /source-line-content"><span class="token comment">\/\* first<\/span><\/span><\/span>\n<span class="source-line" id="L2">.*<span class="token comment">second \*\//s,
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

function sourceText(rendered: string): string | undefined {
  return rendered.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1]
    .replaceAll(/<[^>]+>/g, "")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}
