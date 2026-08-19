import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { renderCodeBlock } from "./render-code-markdown.ts";
import type { ServerConfig } from "./types.ts";

export async function renderText(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
): Promise<Response> {
  const content = renderCodeBlock(
    await Deno.readTextFile(file),
    codeLanguageForPath(file),
  );
  return htmlResponse(
    request,
    await page(config, url.pathname, parts, false, content, rawHref(url)),
  );
}

export function rawHref(url: URL): string {
  const parameters = new URLSearchParams(url.search);
  parameters.delete("raw");
  return `?${parameters.toString()}${parameters.size ? "&" : ""}raw`;
}
