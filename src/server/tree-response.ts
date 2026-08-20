import { join } from "@std/path";
import { entryRoute } from "./entry-route.ts";
import { canonicalPath, lexical, splitPath } from "./paths.ts";
import { plain } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

export async function treeResponse(
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
  const entries = await config.catalog.entries(path);
  const json = entries.map((entry) => treeEntry(config, parts, entry)).sort((
    left,
    right,
  ) => lexical(left.name, right.name));
  return jsonResponse(JSON.stringify(json));
}

function jsonResponse(body: string | null): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function treeEntry(
  config: ServerConfig,
  parts: string[],
  entry: { name: string; directory: boolean },
): {
  name: string;
  path: string;
  directory: boolean;
  href: string;
  filesHref?: string;
  indexPending?: boolean;
  queryRemove?: string[];
} {
  const child = [...parts, entry.name];
  const resolved = entryRoute(parts, entry);
  if (entry.directory) {
    const index = config.catalog.indexState(join(config.rootPath, ...child));
    return {
      name: entry.name,
      path: child.join("/"),
      directory: true,
      href: canonicalPath(resolved.parts, resolved.trailing),
      filesHref: index.known && index.index
        ? `${canonicalPath(resolved.parts, resolved.trailing)}?dir`
        : undefined,
      indexPending: index.known ? undefined : true,
      queryRemove: ["dir"],
    };
  }
  return {
    name: entry.name,
    path: child.join("/"),
    directory: entry.directory,
    href: canonicalPath(resolved.parts, resolved.trailing),
    queryRemove: resolved.trailing ? ["dir"] : undefined,
  };
}
