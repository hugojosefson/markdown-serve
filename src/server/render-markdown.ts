import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import type { PageAction } from "./page.ts";
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
  options: MarkdownOptions = {},
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
      options.directory ?? false,
      content,
      new URL(request.url),
      [rawAction(new URL(request.url)), ...(options.actions ?? [])],
    ),
  );
}

export type MarkdownOptions = {
  actions?: PageAction[];
  directory?: boolean;
};

function rawAction(url: URL): PageAction {
  return {
    href: rawHref(url),
    kind: "raw",
    label: "Raw",
  };
}
