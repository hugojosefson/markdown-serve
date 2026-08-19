import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import type { PageAction } from "./page.ts";
import { renderCodeBlock } from "./render-code-markdown.ts";
import { queryHref, setQuery } from "./query.ts";
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
    await page(config, url.pathname, parts, false, content, url, [
      rawAction(url),
    ]),
  );
}

export function rawHref(url: URL): string {
  return queryHref(url.pathname, setQuery(url.search, "raw", null));
}

function rawAction(url: URL): PageAction {
  return {
    href: rawHref(url),
    kind: "raw",
    label: "Raw",
  };
}
