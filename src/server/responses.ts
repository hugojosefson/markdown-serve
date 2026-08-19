import { contentType } from "@std/media-types";
import { basename } from "@std/path";
import { canonicalQuery } from "./query.ts";

export function plain(text: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : text, { status });
}

export function redirect(
  url: URL,
  pathname: string,
  status: 301 | 302,
  method: string,
): Response {
  url.pathname = pathname;
  const query = canonicalQuery(url.search);
  return new Response(method === "HEAD" ? null : "Redirecting", {
    status,
    headers: { Location: `${url.pathname}${query ? `?${query}` : ""}` },
  });
}

export async function staticFile(
  request: Request,
  path: string,
): Promise<Response> {
  return new Response(
    request.method === "HEAD" ? null : (await Deno.open(path)).readable,
    {
      headers: {
        "content-type": contentType(extension(path)) ??
          "application/octet-stream",
      },
    },
  );
}

export async function rawTextFile(
  request: Request,
  path: string,
): Promise<Response> {
  return new Response(
    request.method === "HEAD" ? null : (await Deno.open(path)).readable,
    { headers: { "content-type": "text/plain; charset=UTF-8" } },
  );
}

function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index);
}
