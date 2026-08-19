import { render } from "@deno/gfm";
import { CodeRenderer } from "./code-renderer.ts";

export function renderCodeMarkdown(markdown: string, baseUrl: string): string {
  return render(markdown, {
    baseUrl,
    renderer: new CodeRenderer({ baseUrl }),
    allowedTags: ["button"],
    allowedClasses: {
      div: ["code-block", "code-toolbar"],
      span: ["code-language", "code-copy-status"],
      button: ["code-copy"],
    },
    allowedAttributes: {
      button: ["type", "data-copy", "aria-label"],
      span: ["aria-live"],
    },
  });
}
