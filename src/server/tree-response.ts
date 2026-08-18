import { join } from "@std/path";
import { directoryEntries, statOrUndefined } from "./fs.ts";
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
  if (!(await statOrUndefined(path))?.isDirectory) {
    return plain("Not Found", 404, request.method);
  }
  const entries = await directoryEntries(path);
  const json = entries.map((entry) => treeEntry(parts, entry)).sort((
    left,
    right,
  ) => lexical(left.name, right.name));
  return new Response(request.method === "HEAD" ? null : JSON.stringify(json), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function treeEntry(
  parts: string[],
  entry: { name: string; directory: boolean },
) {
  const child = [...parts, entry.name];
  const lower = entry.name.toLowerCase();
  const index = !entry.directory && /^(readme|index)\.md$/.test(lower);
  const route = index
    ? parts
    : !entry.directory && lower.endsWith(".md")
    ? [...parts, entry.name.slice(0, -3)]
    : child;
  return {
    name: entry.name,
    path: child.join("/"),
    directory: entry.directory,
    href: canonicalPath(route, entry.directory || index),
  };
}
