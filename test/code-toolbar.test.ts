import { assert, assertMatch, assertNotMatch } from "@std/assert";
import { renderCodeMarkdown } from "../src/server/render-code-markdown.ts";
import { codeToolbarClient } from "../src/server/code-toolbar-client.ts";

Deno.test("fences render a sanitized labelled copy toolbar", () => {
  const html = renderCodeMarkdown(
    "```TS\nconst value = '<tag>';\n```",
    "http://x/",
  );
  assertMatch(html, /class="code-language">ts/);
  assertMatch(html, /class="code-copy" type="button" data-copy/);
  assertMatch(html, /const value = '&lt;tag&gt;/);
  assertNotMatch(html, /onclick/);
});

Deno.test("unlabelled fences use text and copy client targets code", () => {
  const html = renderCodeMarkdown("```\nplain\n```", "http://x/");
  assertMatch(html, /class="code-language">text/);
  assert(codeToolbarClient.includes("navigator.clipboard.writeText"));
  assert(codeToolbarClient.includes("code\?\.textContent \?\? ''"));
});

Deno.test("sanitizer retains toolbar attributes and removes markdown events", () => {
  const html = renderCodeMarkdown(
    "<button onclick=alert(1)>bad</button>\n```bash\necho ok\n```",
    "http://x/",
  );
  assertMatch(html, /aria-live="polite"/);
  assertNotMatch(html, /onclick|alert\(1\)/);
});

Deno.test("fence labels cannot inject markup", () => {
  const html = renderCodeMarkdown(
    '```"><img src=x onerror=alert(1)>\nsafe\n```',
    "http://x/",
  );
  assertNotMatch(html, /<img|onerror|alert\(1\)/);
  assertMatch(html, />safe<\/code>/);
});
