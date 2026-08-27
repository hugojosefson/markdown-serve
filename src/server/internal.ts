import { plain } from "./responses.ts";
import { pageAsset } from "./page-assets.ts";
import { sseResponse } from "./sse-response.ts";
import { treeResponse } from "./tree-response.ts";
import { siteResponse } from "./site-response.ts";
import { fileSearchResponse } from "./file-search-response.ts";
import type { ServerConfig } from "./types.ts";

export async function internalResponse(
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
  if (url.pathname.startsWith("/__markdown_serve__/site/")) {
    return await siteResponse(config, request, url);
  }
  const asset = pageAsset(url.pathname);
  if (asset) {
    return new Response(request.method === "HEAD" ? null : asset.body, {
      headers: {
        "cache-control": "public, max-age=31536000, immutable",
        "content-type": asset.contentType,
      },
    });
  }
  if (url.pathname === "/__markdown_serve__/tree") {
    return await treeResponse(config, request, url.searchParams.get("path"));
  }
  if (url.pathname === "/__markdown_serve__/files") {
    return await fileSearchResponse(
      config,
      request,
      url.searchParams.get("path"),
    );
  }
  if (url.pathname === "/__markdown_serve__/events" && config.reloadSource) {
    return request.method === "HEAD"
      ? new Response(null, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      })
      : sseResponse(config.reloadSource);
  }
  return plain("Not Found", 404, request.method);
}
