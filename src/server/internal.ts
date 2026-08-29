import { plain } from "./responses.ts";
import { pageAsset } from "./page-assets.ts";
import { sseResponse } from "./sse-response.ts";
import { treeResponse } from "./tree-response.ts";
import { siteResponse } from "./site-response.ts";
import { fileSearchResponse } from "./file-search-response.ts";
import { contentSearchResponse } from "./content-search-response.ts";
import { editHighlightResponse, editResponse } from "./edit-response.ts";
import { editMergeResponse } from "./edit-merge-response.ts";
import { validFileRevision } from "./active-file-poller.ts";
import { filePath, splitPath } from "./paths.ts";
import type { ServerConfig } from "./types.ts";

export async function internalResponse(
  config: ServerConfig,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/__markdown_serve__/edit") {
    return await editResponse(config, request, url);
  }
  if (url.pathname === "/__markdown_serve__/highlight") {
    return await editHighlightResponse(config, request, url);
  }
  if (url.pathname === "/__markdown_serve__/merge") {
    return await editMergeResponse(config, request, url);
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
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
      url.searchParams.get("search"),
    );
  }
  if (url.pathname === "/__markdown_serve__/search") {
    return await contentSearchResponse(config, request, url);
  }
  if (url.pathname === "/__markdown_serve__/events" && config.reloadSource) {
    const viewed = viewedFile(config, url);
    if (viewed === null) {
      return plain("Bad Request", 400, request.method);
    }
    return request.method === "HEAD"
      ? new Response(null, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
        },
      })
      : sseResponse(config.reloadSource, viewed);
  }
  return plain("Not Found", 404, request.method);
}

function viewedFile(
  config: ServerConfig,
  url: URL,
): { path: string; revision: string } | undefined | null {
  if (url.searchParams.size === 0) return undefined;
  const path = url.searchParams.get("path");
  const revision = url.searchParams.get("revision");
  if (
    !path || path.length > 4_096 || path.startsWith("/") ||
    url.searchParams.getAll("path").length !== 1 ||
    url.searchParams.getAll("revision").length !== 1 ||
    url.searchParams.size !== 2 || !revision ||
    !validFileRevision(revision)
  ) return null;
  const parts = splitPath(path);
  if (!parts?.length) return null;
  return { path: filePath(config.rootPath, parts), revision };
}
