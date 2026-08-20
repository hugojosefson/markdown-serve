import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { rawPageAction } from "./page-action.ts";
import { renderCodeBlock } from "./render-code-markdown.ts";
import type { ServerConfig } from "./types.ts";

export async function renderText(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
): Promise<Response> {
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const content = renderCodeBlock(
    await Deno.readTextFile(file),
    codeLanguageForPath(file),
  );
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: false,
      content,
      url,
      actions: [rawPageAction()],
    }),
  );
}
