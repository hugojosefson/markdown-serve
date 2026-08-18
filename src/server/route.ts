import { statOrUndefined } from "./fs.ts";
import { canonicalPath, decodePath, filePath } from "./paths.ts";
import { renderDirectory } from "./render-directory.ts";
import { renderMarkdown } from "./render-markdown.ts";
import { plain, redirect, staticFile } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

export async function route(
  config: ServerConfig,
  request: Request,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
  const url = new URL(request.url);
  const parts = decodePath(url.pathname);
  if (!parts) {
    return plain("Bad Request", 400, request.method);
  }
  const target = filePath(config.rootPath, parts);
  const stat = await statOrUndefined(target);
  if (url.pathname.endsWith("/")) {
    return stat?.isDirectory
      ? await renderDirectory(config, request, url, target, parts)
      : plain("Not Found", 404, request.method);
  }
  const markdown = filePath(config.rootPath, [
    ...parts.slice(0, -1),
    `${parts.at(-1)}.md`,
  ]);
  if (
    (!stat || stat.isDirectory) && (await statOrUndefined(markdown))?.isFile
  ) {
    return await renderMarkdown(config, request, url.pathname, markdown, parts);
  }
  if (stat?.isDirectory) {
    return redirect(
      url,
      canonicalPath(parts, true),
      config.redirectStatus,
      request.method,
    );
  }
  if (!stat?.isFile) {
    return plain("Not Found", 404, request.method);
  }
  const name = parts.at(-1)!;
  if (name.toLowerCase().endsWith(".md")) {
    const index = /^(readme|index)\.md$/i.test(name);
    const routeParts = index
      ? parts.slice(0, -1)
      : [...parts.slice(0, -1), name.slice(0, -3)];
    return redirect(
      url,
      canonicalPath(routeParts, index),
      config.redirectStatus,
      request.method,
    );
  }
  return await staticFile(request, target);
}
