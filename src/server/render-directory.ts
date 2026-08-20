import { join } from "@std/path";
import { directoryEntries } from "./fs.ts";
import { breadcrumbPath } from "./breadcrumb.ts";
import { directoryIndex } from "./directory-index.ts";
import { htmlResponse } from "./html-response.ts";
import { indexName } from "./indexes.ts";
import { page } from "./page.ts";
import type { PageAction } from "./page.ts";
import { queryHref, setQuery } from "./query.ts";
import { renderMarkdown } from "./render-markdown.ts";
import type { ServerConfig } from "./types.ts";

export async function renderDirectory(
  config: ServerConfig,
  request: Request,
  url: URL,
  path: string,
  parts: string[],
): Promise<Response> {
  const index = await indexName(path);
  if (index && !url.searchParams.has("dir")) {
    return await renderMarkdown(
      config,
      request,
      url.pathname,
      join(path, index),
      parts,
      { directory: true, sourceName: index, actions: [filesAction(url)] },
    );
  }
  const content = directoryIndex(
    await directoryEntries(path),
    url,
    breadcrumbPath(config.rootLabel, parts),
  );
  return htmlResponse(
    request,
    await page(
      config,
      url.pathname,
      parts,
      true,
      content,
      url,
      { actions: index ? [indexAction(url, index)] : [], directoryView: true },
    ),
  );
}

function filesAction(url: URL): PageAction {
  return {
    href: queryHref(
      url.pathname,
      setQuery(setQuery(url.search, "raw", undefined), "dir", null),
    ),
    kind: "files",
    label: "Files",
    title: "Browse directory files",
  };
}

function indexAction(url: URL, index: string): PageAction {
  return {
    href: queryHref(
      url.pathname,
      setQuery(setQuery(url.search, "dir", undefined), "raw", undefined),
    ),
    kind: "index",
    label: index,
    queryRemove: ["dir"],
    title: `Return to ${index}`,
  };
}
