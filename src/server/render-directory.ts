import { join } from "@std/path";
import { breadcrumbPath } from "./breadcrumb.ts";
import { directoryIndex } from "./directory-index.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filesPageAction, indexPageAction } from "./page-action.ts";
import { renderMarkdown } from "./render-markdown.ts";
import { redirect } from "./responses.ts";
import type { ServerConfig } from "./types.ts";
import { gitStateAt, gitStateAtChild } from "./git/resolver.ts";

export async function renderDirectory(
  config: ServerConfig,
  request: Request,
  url: URL,
  path: string,
  parts: string[],
): Promise<Response> {
  const index = await config.catalog.index(path);
  if (
    request.method === "POST" &&
    (!index || url.searchParams.has("dir") || !url.searchParams.has("edit"))
  ) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
  if (!index && url.searchParams.has("dir")) {
    url.searchParams.delete("dir");
    return redirect(url, url.pathname, config.redirectStatus, request.method);
  }
  if (index && !url.searchParams.has("dir")) {
    return await renderMarkdown(
      config,
      request,
      url.pathname,
      join(path, index),
      parts,
      {
        directory: true,
        sourceName: index,
        headerActions: [filesPageAction(url)],
      },
    );
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const gitStatus = await (await gitStateAt(config, path))?.status();
  const entries = await config.catalog.entries(path);
  const entryStatuses = new Map(
    await Promise.all(
      entries.filter((entry) => entry.directory).map(async (entry) =>
        [
          entry.name,
          await (await gitStateAtChild(
            config,
            path,
            join(path, entry.name),
          ))?.status(),
        ] as const
      ),
    ),
  );
  const content = directoryIndex(
    entries,
    url,
    breadcrumbPath(config.rootLabel, parts),
    gitStatus,
    parts.join("/"),
    entryStatuses,
  );
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: true,
      content,
      url,
      headerActions: index ? [indexPageAction(url, index)] : [],
      directoryView: true,
      gitStatus,
    }),
  );
}
