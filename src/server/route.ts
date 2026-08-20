import { classifyEntry, entryRoute } from "./entry-route.ts";
import { canonicalPath, decodePath, filePath } from "./paths.ts";
import { renderDirectory } from "./render-directory.ts";
import { renderMarkdown } from "./render-markdown.ts";
import { renderText } from "./render-text.ts";
import { renderFile } from "./render-file.ts";
import { downloadFile, plain, rawFile, redirect } from "./responses.ts";
import { previewableFile } from "./file-metadata.ts";
import { isTextFile } from "./text-file.ts";
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
  const resolved = await resolveRoute(
    config,
    new URL(request.url),
    config.catalog,
  );
  if (resolved.kind === "bad-request") {
    return plain("Bad Request", 400, request.method);
  }
  if (resolved.kind === "not-found") {
    return plain("Not Found", 404, request.method);
  }
  if (resolved.kind === "redirect") {
    return redirect(
      resolved.url,
      resolved.pathname,
      config.redirectStatus,
      request.method,
    );
  }
  if (resolved.kind === "directory") {
    return await renderDirectory(
      config,
      request,
      resolved.url,
      resolved.path,
      resolved.parts,
    );
  }
  if (resolved.kind === "markdown") {
    return await renderMarkdown(
      config,
      request,
      resolved.url.pathname,
      resolved.path,
      resolved.parts,
      { sourceName: resolved.sourceName },
    );
  }
  if (resolved.kind === "raw" || resolved.kind === "download") {
    return resolved.kind === "raw"
      ? await rawFile(request, resolved.path, resolved.text)
      : await downloadFile(request, resolved.path);
  }
  if (resolved.kind === "text") {
    return await renderText(
      config,
      request,
      resolved.url,
      resolved.path,
      resolved.parts,
    );
  }
  if (resolved.kind === "static") {
    return await renderFile(
      config,
      request,
      resolved.url,
      resolved.path,
      resolved.parts,
    );
  }
  throw new Error("unreachable route");
}

export type ResolvedRoute =
  | { kind: "bad-request" | "not-found" }
  | { kind: "redirect"; url: URL; pathname: string }
  | {
    kind: "directory";
    url: URL;
    path: string;
    parts: string[];
  }
  | {
    kind: "markdown";
    url: URL;
    path: string;
    parts: string[];
    sourceName: string;
  }
  | {
    kind: "text" | "static" | "raw" | "download";
    url: URL;
    path: string;
    parts: string[];
    text?: boolean;
  };

export async function resolveRoute(
  config: ServerConfig,
  url: URL,
  catalog = config.catalog,
): Promise<ResolvedRoute> {
  const decodedParts = decodePath(url.pathname);
  if (!decodedParts) {
    return { kind: "bad-request" };
  }
  const parts = decodedParts;
  const target = filePath(config.rootPath, parts);
  const stat = await catalog.stat(target);
  if (url.pathname.endsWith("/")) {
    return stat?.isDirectory
      ? { kind: "directory", url, path: target, parts }
      : { kind: "not-found" };
  }
  const routeLeaf = parts.at(-1)!;
  const parent = filePath(config.rootPath, parts.slice(0, -1));
  const sourceName = (!stat || stat.isDirectory)
    ? await catalog.markdown(parent, routeLeaf)
    : undefined;
  if (sourceName) {
    return {
      kind: "markdown",
      url,
      path: filePath(parent, [sourceName]),
      parts,
      sourceName,
    };
  }
  if (stat?.isDirectory) {
    return { kind: "redirect", url, pathname: canonicalPath(parts, true) };
  }
  if (!stat?.isFile) {
    return { kind: "not-found" };
  }
  const entry = { name: parts.at(-1)!, directory: false };
  if (classifyEntry(entry).markdown) {
    const route = entryRoute(parts.slice(0, -1), entry);
    return {
      kind: "redirect",
      url,
      pathname: canonicalPath(route.parts, route.trailing),
    };
  }
  if (url.searchParams.has("raw")) {
    const text = !previewableFile(target) && await isTextFile(target);
    return { kind: "raw", url, path: target, parts, text };
  }
  if (url.searchParams.has("download")) {
    return { kind: "download", url, path: target, parts };
  }
  if (previewableFile(target)) {
    return { kind: "static", url, path: target, parts };
  }
  // Sampling stays method-independent so GET and HEAD have matching types.
  const text = await isTextFile(target);
  if (text) {
    return { kind: "text", url, path: target, parts };
  }
  return { kind: "static", url, path: target, parts };
}
