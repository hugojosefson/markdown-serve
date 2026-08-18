import { contentType } from "@std/media-types";
import { basename } from "@std/path";

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
  return new Response(method === "HEAD" ? null : "Redirecting", {
    status,
    headers: { Location: `${url.pathname}${url.search}` },
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

function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index);
}
