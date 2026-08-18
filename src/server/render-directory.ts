import { join } from "@std/path";
import { directoryEntries } from "./fs.ts";
import { escapeHtml } from "./html.ts";
import { htmlResponse } from "./html-response.ts";
import { indexName } from "./indexes.ts";
import { page } from "./page.ts";
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
  if (index) {
    return await renderMarkdown(
      config,
      request,
      url.pathname,
      join(path, index),
      parts,
      true,
    );
  }
  const entries = await directoryEntries(path);
  const items = entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  ).map((entry) => {
    const suffix = entry.directory ? "/" : "";
    return `<li><a href="${
      escapeHtml(encodeURIComponent(entry.name) + suffix)
    }">${escapeHtml(entry.name + suffix)}</a></li>`;
  }).join("");
  const content = `<h1>Index of ${
    escapeHtml(url.pathname)
  }</h1><ul>${items}</ul>`;
  return htmlResponse(
    request,
    await page(config, url.pathname, parts, true, content),
  );
}
