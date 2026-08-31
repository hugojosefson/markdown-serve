import { escapeHtml } from "./html.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import type { ServerConfig } from "./types.ts";
import { viewedFileTarget } from "./active-file-poller.ts";

export async function renderBrokenSymlink(
  config: ServerConfig,
  request: Request,
  url: URL,
  path: string,
  parts: string[],
  target: string,
  info: Deno.FileInfo,
): Promise<Response> {
  if (request.method === "HEAD") return htmlResponse(request, "");
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: false,
      url,
      content: `<p class="empty-file">Broken symlink: <code>${
        escapeHtml(target)
      }</code></p>`,
      reloadTarget: viewedFileTarget(config.rootPath, path, info),
    }),
  );
}
