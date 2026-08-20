import { join } from "@std/path";
import { breadcrumbPath } from "./breadcrumb.ts";
import { directoryIndex } from "./directory-index.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filesPageAction, indexPageAction } from "./page-action.ts";
import { renderMarkdown } from "./render-markdown.ts";
import type { ServerConfig } from "./types.ts";

export async function renderDirectory(
  config: ServerConfig,
  request: Request,
  url: URL,
  path: string,
  parts: string[],
): Promise<Response> {
  const index = await config.catalog.index(path);
  if (index && !url.searchParams.has("dir")) {
    return await renderMarkdown(
      config,
      request,
      url.pathname,
      join(path, index),
      parts,
      { directory: true, sourceName: index, actions: [filesPageAction(url)] },
    );
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const content = directoryIndex(
    await config.catalog.entries(path),
    url,
    breadcrumbPath(config.rootLabel, parts),
  );
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: true,
      content,
      url,
      actions: index ? [indexPageAction(url, index)] : [],
      directoryView: true,
    }),
  );
}
