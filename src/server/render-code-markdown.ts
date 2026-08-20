import { render } from "@deno/gfm";
import { CodeRenderer } from "./code-renderer.ts";
import "./prism-languages.ts";
import { renderSourceLines } from "./render-source-lines.ts";
import type { SourceLineAnnotation } from "./git/diff.ts";
import { analyzeSymbols } from "./symbols/analyze.ts";
import { injectSymbols } from "./symbols/inject.ts";

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
        "attr-value",
        "punctuation",
        "script-punctuation",
        "script",
        "selector",
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

export function renderCodeBlock(text: string, language: string): string {
  return new CodeRenderer().code({
    type: "code",
    raw: text,
    text,
    lang: language,
  });
}

export function renderSourceCodeBlock(
  text: string,
  language: string,
  annotations?: ReadonlyMap<number, SourceLineAnnotation>,
): string {
  const rendered = renderCodeBlock(text, language);
  const code = replaceSourceCode(rendered, "code", annotations);
  return code === rendered
    ? replaceSourceCode(rendered, "pre", annotations)
    : code;
}

export async function renderSourceCodeBlockWithSymbols(
  text: string,
  language: string,
  annotations?: ReadonlyMap<number, SourceLineAnnotation>,
): Promise<string> {
  const rendered = renderCodeBlock(text, language);
  const symbols = await analyzeSymbols(text, language);
  const replace = (tag: "code" | "pre") =>
    rendered.replace(
      new RegExp(`(<${tag}(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/${tag}>)`),
      (_, open, highlighted, close) =>
        `${open}${
          renderSourceLines(
            symbols
              ? injectSymbols(highlighted, symbols.occurrences)
              : highlighted,
            annotations,
            symbols?.declarationLines,
            symbols?.declarationLinks,
          )
        }${close}`,
    );
  const code = replace("code");
  return code === rendered ? replace("pre") : code;
}

function replaceSourceCode(
  rendered: string,
  tag: "code" | "pre",
  annotations?: ReadonlyMap<number, SourceLineAnnotation>,
): string {
  const expression = new RegExp(
    `(<${tag}(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/${tag}>)`,
  );
  return rendered.replace(
    expression,
    (_, open, highlighted, close) =>
      `${open}${renderSourceLines(highlighted, annotations)}${close}`,
  );
}
