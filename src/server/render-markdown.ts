import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { renderCodeMarkdown } from "./render-code-markdown.ts";
import { rawHref } from "./render-text.ts";
import { rawTextFile } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

export async function renderMarkdown(
  config: ServerConfig,
  request: Request,
  pathname: string,
  file: string,
  parts: string[],
  directory = false,
): Promise<Response> {
  if (new URL(request.url).searchParams.has("raw")) {
    return await rawTextFile(request, file);
  }
  const base = new URL(request.url);
  base.pathname = pathname;
  base.search = "";
  const content = renderCodeMarkdown(await Deno.readTextFile(file), base.href);
  return htmlResponse(
    request,
    await page(
      config,
      pathname,
      parts,
      directory,
      content,
      rawHref(new URL(request.url)),
    ),
  );
}
