import { CSS, render } from "@deno/gfm";
import { contentType } from "@std/media-types";
import { basename, join, resolve } from "@std/path";

/** Configuration shared by the request handler and server. */
export interface HandlerOptions {
  root: string;
  /** Status used for canonical URL redirects. Defaults to 302. */
  redirectStatus?: 301 | 302;
  /** Converts filesystem failures into an application response. */
  onError?: (error: unknown) => Response | Promise<Response>;
}

/** Configuration for an exact-port HTTP server. */
export interface ServerOptions extends HandlerOptions {
  /** Interface to bind. Defaults to `localhost`. */
  hostname?: string;
  /** Exact port to bind. Defaults to 8000. */
  port?: number;
  signal?: AbortSignal;
  onListen?: (address: Deno.NetAddr) => void;
}

interface ServerConfig {
  rootPath: string;
  redirectStatus: 301 | 302;
  onError?: HandlerOptions["onError"];
}

export type RequestHandler = (request: Request) => Promise<Response>;

export async function createHandler(
  options: HandlerOptions,
): Promise<RequestHandler> {
  const rootPath = resolve(options.root);
  try {
    if (!(await Deno.stat(rootPath)).isDirectory) {
      throw new Error("not a directory");
    }
    return handler({
      rootPath,
      redirectStatus: options.redirectStatus ?? 302,
      onError: options.onError,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`cannot access root ${options.root}: ${reason}`);
  }
}

/** Creates an HTTP server bound to exactly `options.port` (or 8000). */
export async function serve(options: ServerOptions): Promise<Deno.HttpServer> {
  const { hostname = "localhost", port = 8000, signal, onListen } = options;
  return Deno.serve(
    { hostname, port, signal, onListen },
    await createHandler(options),
  );
}

function handler(config: ServerConfig): RequestHandler {
  return async (request) => {
    try {
      return await route(config, request);
    } catch (error) {
      return config.onError
        ? await config.onError(error)
        : plain("Internal Server Error", 500, request.method);
    }
  };
}

async function route(
  config: ServerConfig,
  request: Request,
): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" },
    });
  }
  let url: URL;
  let parts: string[];
  try {
    url = new URL(request.url);
    parts = decodePath(url.pathname);
  } catch {
    return plain("Bad Request", 400, request.method);
  }
  const trailing = url.pathname.endsWith("/");
  const target = pathFromParts(config.rootPath, parts);

  const stat = await safeStat(target);
  if (trailing) {
    if (!stat?.isDirectory) return plain("Not Found", 404, request.method);
    return directoryResponse(request, url, target, parts);
  }

  // A clean Markdown route has precedence over a same-named directory.
  const markdownTarget = pathFromParts(config.rootPath, [
    ...parts.slice(0, -1),
    `${parts.at(-1)}.md`,
  ]);
  if (!stat || stat.isDirectory) {
    const markdownStat = await safeStat(markdownTarget);
    if (markdownStat?.isFile) {
      return markdownResponse(request, url.pathname, markdownTarget, parts);
    }
  }
  if (stat?.isDirectory) {
    return redirect(
      url,
      canonicalPath(parts, true),
      config.redirectStatus,
      request.method,
    );
  }
  if (!stat?.isFile) return plain("Not Found", 404, request.method);

  const name = basename(target);
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".md")) {
    const parent = parts.slice(0, -1);
    if (/^(readme|index)\.md$/i.test(name)) {
      return redirect(
        url,
        canonicalPath(parent, true),
        config.redirectStatus,
        request.method,
      );
    }
    return redirect(
      url,
      canonicalPath([...parts.slice(0, -1), name.slice(0, -3)]),
      config.redirectStatus,
      request.method,
    );
  }
  return staticResponse(request, target);
}

function decodePath(pathname: string): string[] {
  const raw = pathname.split("/").filter(Boolean);
  return raw.map((part) => {
    const decoded = decodeURIComponent(part);
    if (
      !decoded || decoded === "." || decoded === ".." ||
      decoded.includes("/") || decoded.includes("\\") || decoded.includes("\0")
    ) throw new Error("invalid path");
    return decoded;
  });
}

function pathFromParts(root: string, parts: string[]): string {
  return join(root, ...parts);
}
function canonicalPath(parts: string[], trailing = false): string {
  return `/${parts.map(encodeURIComponent).join("/")}${trailing ? "/" : ""}`;
}

async function safeStat(path: string): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
}

async function directoryResponse(
  request: Request,
  url: URL,
  path: string,
  parts: string[],
): Promise<Response> {
  const index = await directoryIndex(path);
  if (index) {
    return markdownResponse(request, url.pathname, join(path, index), parts);
  }
  const entries: Array<{ name: string; isDirectory: boolean }> = [];
  for await (const entry of Deno.readDir(path)) entries.push(entry);
  const resolvedEntries = await Promise.all(entries.map(async (entry) => ({
    name: entry.name,
    isDirectory: (await safeStat(join(path, entry.name)))?.isDirectory ?? false,
  })));
  resolvedEntries.sort((a, b) => lexical(a.name, b.name));
  const items = resolvedEntries.map((entry) => {
    const suffix = entry.isDirectory ? "/" : "";
    return `<li><a href="${
      escapeHtml(encodeURIComponent(entry.name) + suffix)
    }">${escapeHtml(entry.name + suffix)}</a></li>`;
  }).join("");
  return html(
    request,
    page(
      url.pathname,
      breadcrumbs(parts),
      `<h1>Index of ${escapeHtml(url.pathname)}</h1><ul>${items}</ul>`,
    ),
  );
}

async function directoryIndex(path: string): Promise<string | undefined> {
  const names: string[] = [];
  for await (const entry of Deno.readDir(path)) {
    if (
      (await safeStat(join(path, entry.name)))?.isFile &&
      /^(readme|index)\.md$/i.test(entry.name)
    ) {
      names.push(entry.name);
    }
  }
  for (const conventional of ["README.md", "index.md"]) {
    const choices = names.filter((name) =>
      name.toLowerCase() === conventional.toLowerCase()
    );
    const exact = choices.find((name) => name === conventional);
    if (exact) return exact;
    if (choices.length) return choices.sort(lexical)[0];
  }
}

async function markdownResponse(
  request: Request,
  pathname: string,
  file: string,
  parts: string[],
): Promise<Response> {
  const markdown = await Deno.readTextFile(file);
  const baseUrl = new URL(request.url);
  baseUrl.pathname = pathname;
  baseUrl.search = "";
  baseUrl.hash = "";
  return html(
    request,
    page(
      pathname,
      breadcrumbs(parts),
      render(markdown, { baseUrl: baseUrl.href }),
    ),
  );
}

async function staticResponse(
  request: Request,
  path: string,
): Promise<Response> {
  const headers = new Headers({
    "content-type": contentType(extension(path)) ?? "application/octet-stream",
  });
  return new Response(
    request.method === "HEAD" ? null : (await Deno.open(path)).readable,
    { headers },
  );
}

function redirect(
  url: URL,
  pathname: string,
  status: 301 | 302,
  method: string,
): Response {
  url.pathname = pathname;
  return new Response(method === "HEAD" ? null : "Redirecting", {
    status,
    headers: { Location: `${url.pathname}${url.search}` },
  });
}
function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index);
}
function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function plain(text: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : text, { status });
}
function html(request: Request, body: string): Response {
  return new Response(request.method === "HEAD" ? null : body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
function breadcrumbs(parts: string[]): string {
  const links = [`<a href="/">Home</a>`];
  for (let index = 0; index < parts.length; index++) {
    links.push(
      `<a href="/${
        parts.slice(0, index + 1).map(encodeURIComponent).join("/")
      }/">${escapeHtml(parts[index])}</a>`,
    );
  }
  return `<nav aria-label="Breadcrumb">${links.join(" / ")}</nav>`;
}
function page(title: string, navigation: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${
    escapeHtml(title)
  }</title><style>${CSS}\n:root{color-scheme:light dark}body{max-width:960px;margin:2rem auto;padding:0 1rem;font-family:system-ui,sans-serif}nav{margin-bottom:1rem}a{overflow-wrap:anywhere}</style></head><body>${navigation}<main class="markdown-body">${content}</main></body></html>`;
}
function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(
    ">",
    "&gt;",
  ).replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
