import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { rawPageAction } from "./page-action.ts";
import type { PageAction } from "./page-action.ts";
import { renderCodeMarkdown } from "./render-code-markdown.ts";
import { rawTextFile } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

export async function renderMarkdown(
  config: ServerConfig,
  request: Request,
  pathname: string,
  file: string,
  parts: string[],
  options: MarkdownOptions = {},
): Promise<Response> {
  if (new URL(request.url).searchParams.has("raw")) {
    return await rawTextFile(request, file);
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const base = new URL(request.url);
  base.pathname = pathname;
  base.search = "";
  const content = renderCodeMarkdown(await Deno.readTextFile(file), base.href);
  return htmlResponse(
    request,
    await page(config, {
      title: pathname,
      parts,
      directory: options.directory ?? false,
      content,
      url: new URL(request.url),
      actions: [rawPageAction(), ...(options.actions ?? [])],
      directoryView: options.directoryView,
      sourceName: options.sourceName,
    }),
  );
}

export type MarkdownOptions = {
  actions?: PageAction[];
  directory?: boolean;
  directoryView?: boolean;
  sourceName?: string;
};
