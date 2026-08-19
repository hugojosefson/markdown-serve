import { type Marked, Renderer } from "@deno/gfm";
import { codeLanguage } from "./code-language.ts";
import { escapeHtml } from "./html.ts";

export class CodeRenderer extends Renderer {
  override code(token: Marked.Tokens.Code): string {
    const renderedToken = { ...token, lang: codeLanguage(token.lang) };
    const language = escapeHtml(renderedToken.lang);
    return `<div class="code-block"><div class="code-toolbar"><span class="code-language">${language}</span><button class="code-copy" type="button" data-copy aria-label="Copy ${language} code">Copy</button><span class="code-copy-status" aria-live="polite"></span></div>${
      super.code(renderedToken)
    }</div>`;
  }
}
