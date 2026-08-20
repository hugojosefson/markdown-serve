import { join } from "@std/path";
import { entryRoute } from "./entry-route.ts";
import type { IndexState } from "./file-catalog.ts";
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
  filesLabel?: string;
  queryRemove?: string[];
} {
  const child = [...parts, entry.name];
  const resolved = entryRoute(parts, entry);
  if (entry.directory) {
    return {
      name: entry.name,
      path: child.join("/"),
      directory: true,
      href: canonicalPath(resolved.parts, resolved.trailing),
      filesHref: directoryFilesHref(
        canonicalPath(resolved.parts, resolved.trailing),
        config.catalog.indexState(join(config.rootPath, ...child)),
      ),
      queryRemove: ["dir"],
    };
  }
  const href = canonicalPath(resolved.parts, resolved.trailing);
  return {
    name: entry.name,
    path: child.join("/"),
    directory: entry.directory,
    href,
    filesHref: resolved.trailing ? `${href}?dir` : undefined,
    filesLabel: resolved.trailing
      ? (parts.at(-1) ?? config.rootLabel)
      : undefined,
    queryRemove: resolved.trailing ? ["dir"] : undefined,
  };
}

function directoryFilesHref(href: string, indexState: IndexState): string {
  return indexState.known && !indexState.index ? href : `${href}?dir`;
}
