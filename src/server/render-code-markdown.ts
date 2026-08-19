import { render } from "@deno/gfm";
import { CodeRenderer } from "./code-renderer.ts";
import "./prism-languages.ts";

export function renderCodeMarkdown(markdown: string, baseUrl: string): string {
  return render(markdown, {
    baseUrl,
    renderer: new CodeRenderer({ baseUrl }),
    allowedTags: ["button"],
    allowedClasses: {
      div: [
        "code-block",
        "code-toolbar",
        "highlight",
        "highlight-source-*",
        "notranslate",
      ],
      span: [
        "code-language",
        "code-copy-status",
        "token",
        "keyword",
        "operator",
        "number",
        "boolean",
        "function",
        "string",
        "comment",
        "class-name",
        "regex",
        "regex-delimiter",
        "tag",
        "attr-name",
        "punctuation",
        "script-punctuation",
        "script",
        "plain-text",
        "property",
        "prefix",
        "line",
        "deleted",
        "inserted",
        "key",
        "atrule",
      ],
      button: ["code-copy"],
    },
    allowedAttributes: {
      button: ["type", "data-copy", "aria-label"],
      span: ["aria-live"],
    },
  });
}
