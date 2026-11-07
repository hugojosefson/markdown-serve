import type { Marked } from "@deno/gfm";
import { MarkdownHeadingRenderer } from "./markdown-heading-renderer.ts";
import { codeLanguage } from "./code-language.ts";
import { escapeHtml } from "./html.ts";

export class CodeRenderer extends MarkdownHeadingRenderer {
  override code(token: Marked.Tokens.Code): string {
    const renderedToken = { ...token, lang: codeLanguage(token.lang) };
    const language = escapeHtml(renderedToken.lang);
    return `<div class="code-block"><div class="code-toolbar"><span class="code-language">${language}</span><span class="code-toolbar-file-actions" data-file-actions="leading"></span><button class="code-copy" type="button" data-copy aria-label="Copy ${language} code">Copy</button><span class="code-toolbar-file-actions" data-file-actions="trailing"></span><span class="code-copy-status" aria-live="polite"></span></div>${
      super.code(renderedToken)
    }</div>`;
  }
}
