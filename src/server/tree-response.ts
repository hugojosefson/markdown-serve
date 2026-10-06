import { join } from "@std/path";
import { entryRoute } from "./entry-route.ts";
import { compareDirectoriesFirst } from "./directory-order.ts";
import type { IndexState } from "./file-catalog.ts";
import { canonicalPath, splitPath } from "./paths.ts";
import { plain } from "./responses.ts";
import type { ServerConfig } from "./types.ts";
import { entryKind } from "./entry-kind.ts";
import { gitDisplay, gitStatusAt } from "./git/status.ts";
import { gitStateAt, gitStateAtChild } from "./git/resolver.ts";

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
  if (config.access?.isDenied(path)) {
    return plain("Forbidden", 403, request.method);
  }
  if (!(await config.catalog.stat(path))?.isDirectory) {
    if (config.access?.isDenied(path)) {
      return plain("Forbidden", 403, request.method);
    }
    return plain("Not Found", 404, request.method);
  }
  if (request.method === "HEAD") {
    return jsonResponse(null);
  }
  const entries = await config.catalog.entries(path);
  if (config.access?.isDenied(path)) {
    return plain("Forbidden", 403, request.method);
  }
  const status = await (await gitStateAt(config, path))?.status();
  const json = (await Promise.all(
    entries.map((entry) => treeEntry(config, parts, entry, status)),
  ))
    .sort(compareDirectoriesFirst);
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

async function treeEntry(
  config: ServerConfig,
  parts: string[],
  entry: import("./fs.ts").DirectoryEntry,
  status: import("./git/status.ts").GitStatus | undefined,
): Promise<{
  name: string;
  path: string;
  directory: boolean;
  href: string;
  filesHref?: string;
  filesLabel?: string;
  queryRemove?: string[];
  kind: string;
  target?: string;
  broken?: boolean;
  accessDenied?: boolean;
  git?: { display: string; kind: string; tooltip: string };
}> {
  const child = [...parts, entry.name];
  const resolved = entryRoute(parts, entry);
  const parent = join(config.rootPath, ...parts);
  const state = entry.directory
    ? await gitStateAtChild(config, parent, join(parent, entry.name))
    : await gitStateAt(config, parent);
  const entryStatus = await state?.status() ?? status;
  const git = gitStatusAt(entryStatus, child.join("/"), entry.directory);
  const metadata = git
    ? {
      git: { display: gitDisplay(git), kind: git.kind, tooltip: git.tooltip },
    }
    : {};
  if (entry.directory) {
    const accessDenied = config.access?.isDenied(
      join(config.rootPath, ...child),
    );
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
      kind: entryKind(entry),
      ...(entry.target === undefined ? {} : { target: entry.target }),
      ...(entry.broken ? { broken: true } : {}),
      ...(accessDenied ? { accessDenied: true } : {}),
      ...metadata,
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
    kind: entryKind(entry),
    ...(entry.target === undefined ? {} : { target: entry.target }),
    ...(entry.broken ? { broken: true } : {}),
    ...metadata,
  };
}

function directoryFilesHref(href: string, indexState: IndexState): string {
  return indexState.known && !indexState.index ? href : `${href}?dir`;
}
