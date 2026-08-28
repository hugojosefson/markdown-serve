import { render } from "@deno/gfm";
import { CodeRenderer } from "./code-renderer.ts";
import "./prism-languages.ts";
import { renderSourceLines } from "./render-source-lines.ts";
import type { SourceLineAnnotation } from "./git/diff.ts";
import { analyzeSymbols } from "./symbols/analyze.ts";
import { injectSymbols } from "./symbols/inject.ts";
import type { SymbolTargets } from "./symbols/types.ts";

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
        "code-toolbar-file-actions",
        "code-copy-status",
        "token",
        "keyword",
        "operator",
        "number",
        "boolean",
        "function",
        "heredoc",
        "interpolation",
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
        "arrow",
        "color",
        "delimiter",
        "divider",
        "expression",
        "important",
        "preprocessor",
        "symbol",
        "text",
        "time",
        "type",
        "variable",
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
      span: ["aria-live", "data-file-actions"],
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

export function renderHighlightedCode(text: string, language: string): string {
  const rendered = renderCodeBlock(text, language);
  const highlighted = rendered.match(/<code[^>]*>([\s\S]*)<\/code>/)?.[1] ??
    rendered.match(/<pre[^>]*>([\s\S]*)<\/pre>/)?.[1] ?? "";
  return language === "markdown"
    ? markMarkdownHeadings(highlighted)
    : highlighted;
}

function markMarkdownHeadings(highlighted: string): string {
  return highlighted.replace(
    /<span class="token title important"><span class="token punctuation">(#{1,6})<\/span>/g,
    (_, marker: string) =>
      `<span class="token title important edit-heading-${marker.length}"><span class="token punctuation">${marker}</span>`,
  );
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
  targets?: SymbolTargets,
): Promise<string> {
  const rendered = renderCodeBlock(text, language);
  const symbols = await analyzeSymbols(text, language, targets);
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
            symbols?.declarationCommentLines,
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
