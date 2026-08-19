import { type Marked, Renderer } from "@deno/gfm";
import { escapeHtml } from "./html.ts";

const languageAliases: Readonly<Record<string, string>> = {
  js: "javascript",
  md: "markdown",
  sh: "bash",
  shell: "bash",
  ts: "typescript",
  yml: "yaml",
};

export class CodeRenderer extends Renderer {
  override code(token: Marked.Tokens.Code): string {
    const renderedToken = { ...token, lang: fenceLanguage(token.lang) };
    const language = escapeHtml(renderedToken.lang);
    return `<div class="code-block"><div class="code-toolbar"><span class="code-language">${language}</span><button class="code-copy" type="button" data-copy aria-label="Copy ${language} code">Copy</button><span class="code-copy-status" aria-live="polite"></span></div>${
      super.code(renderedToken)
    }</div>`;
  }
}

function fenceLanguage(language?: string): string {
  const name = language?.split(",")[0]?.trim().split(/\s+/)[0]
    ?.toLowerCase() || "text";
  return languageAliases[name] ?? name;
}
