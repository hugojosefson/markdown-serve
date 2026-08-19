import { type Marked, Renderer } from "@deno/gfm";
import { escapeHtml } from "./html.ts";

export class CodeRenderer extends Renderer {
  override code(token: Marked.Tokens.Code): string {
    const language = escapeHtml(fenceLanguage(token.lang));
    return `<div class="code-block"><div class="code-toolbar"><span class="code-language">${language}</span><button class="code-copy" type="button" data-copy aria-label="Copy ${language} code">Copy</button><span class="code-copy-status" aria-live="polite"></span></div>${
      super.code(token)
    }</div>`;
  }
}

function fenceLanguage(language?: string): string {
  return language?.split(",")[0]?.trim().split(/\s+/)[0]?.toLowerCase() ||
    "text";
}
