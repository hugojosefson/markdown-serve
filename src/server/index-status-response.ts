import { join } from "@std/path";
import { canonicalPath, splitPath } from "./paths.ts";
import { plain } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

export async function indexStatusResponse(
  config: ServerConfig,
  request: Request,
  raw: string | null,
): Promise<Response> {
  const parts = splitPath(raw ?? "");
  if (!parts) {
    return plain("Bad Request", 400, request.method);
  }
  const path = join(config.rootPath, ...parts);
  if (!(await config.catalog.stat(path))?.isDirectory) {
    return plain("Not Found", 404, request.method);
  }
  if (request.method === "HEAD") {
    return jsonResponse(null);
  }
  const index = await config.catalog.index(path);
  const body = JSON.stringify({
    filesHref: index ? `${canonicalPath(parts, true)}?dir` : undefined,
  });
  return jsonResponse(body);
}

function jsonResponse(body: string | null): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
