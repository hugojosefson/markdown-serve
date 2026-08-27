import {
  contentSearchOptions,
  runRg,
  searchContent,
} from "./content-search.ts";
import { plain } from "./responses.ts";
import { splitPath } from "./paths.ts";
import type { ServerConfig } from "./types.ts";

export async function contentSearchResponse(
  config: ServerConfig,
  request: Request,
  url: URL,
): Promise<Response> {
  const parts = splitPath(url.searchParams.get("path") ?? "");
  const options = contentSearchOptions(url.searchParams);
  if (!parts || !options) return plain("Bad Request", 400, request.method);
  if (request.method === "HEAD") return response(null);
  try {
    const results = await searchContent(
      config.rootPath,
      parts,
      options,
      config.contentSearchRunner ?? runRg,
      request.signal,
    );
    return response(JSON.stringify(results));
  } catch {
    return plain("Repository search unavailable", 503, request.method);
  }
}
function response(body: string | null): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
