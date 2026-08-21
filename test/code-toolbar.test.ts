import { assert, assertMatch, assertNotMatch } from "@std/assert";
import { renderCodeMarkdown } from "../src/server/render-code-markdown.ts";
import { codeToolbarClient } from "../src/server/code-toolbar-client.ts";
import { codeToolbarCss } from "../src/server/code-toolbar-css.ts";

Deno.test("fences normalize aliases and render Prism tokens", () => {
  const html = renderCodeMarkdown(
    "```TS\nconst value = '<tag>';\n```",
    "http://x/",
  );
  assertMatch(html, /class="code-language">typescript/);
  assertMatch(
    html,
    /class="code-toolbar-file-actions" data-file-actions="leading"><\/span><button class="code-copy"/,
  );
  assertMatch(html, /class="code-copy" type="button" data-copy/);
  assertMatch(html, /highlight-source-typescript/);
  assertMatch(html, /class="token keyword">const/);
  assertMatch(html, /&lt;tag&gt;/);
  assertNotMatch(html, /onclick/);
  assertMatch(
    codeToolbarCss,
    /\.code-toolbar \{[^}]*min-height: 30px;[^}]*overflow-x: auto;/,
  );
  assertMatch(
    codeToolbarCss,
    /\.code-toolbar \.file-action, \.code-copy \{[^}]*height: 22px; justify-content: center;/,
  );
  assertMatch(codeToolbarCss, /\.code-copy \{ min-width: 46px; \}/);
  assertMatch(
    codeToolbarCss,
    /\[data-file-actions="leading"\] \{ margin-left: auto; \}/,
  );
});

Deno.test("shell aliases load the Bash grammar", () => {
  const html = renderCodeMarkdown("```sh\necho $HOME\n```", "http://x/");
  assertMatch(html, /class="code-language">bash/);
  assertMatch(html, /highlight-source-bash/);
  assertMatch(html, /class="token class-name">echo/);
});

Deno.test("unlabelled fences use text and copy client targets code", () => {
  const html = renderCodeMarkdown("```\nplain\n```", "http://x/");
  assertMatch(html, /class="code-language">text/);
  assertMatch(html, /<pre>plain<\/pre>/);
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
  assertMatch(html, /<pre>safe<\/pre>/);
});
