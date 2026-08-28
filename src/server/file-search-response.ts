import { plain } from "./responses.ts";
import { searchFiles } from "./file-search.ts";
import type { ServerConfig } from "./types.ts";

export async function fileSearchResponse(
  config: ServerConfig,
  request: Request,
  search: string | null,
): Promise<Response> {
  const query = search ?? "";
  if ([...query].length > 256) return plain("Bad Request", 400, request.method);
  if (request.method === "HEAD") return json(null);
  const files = await searchFiles(config, query, request.signal);
  return json(JSON.stringify(files));
}

function json(body: string | null): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}
