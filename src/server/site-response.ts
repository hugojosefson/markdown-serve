import { decodePath, filePath } from "./paths.ts";
import { plain, rawFile, redirect } from "./responses.ts";
import type { ServerConfig } from "./types.ts";

const sitePrefix = "/__markdown_server__/site/";
const htmlPreviewCsp =
  "sandbox allow-scripts; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'; form-action 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

export async function siteResponse(
  config: ServerConfig,
  request: Request,
  url: URL,
): Promise<Response> {
  const parts = decodePath(url.pathname.slice(sitePrefix.length - 1));
  if (!parts) {
    return plain("Bad Request", 400, request.method);
  }
  const path = filePath(config.rootPath, parts);
  const stat = await config.catalog.stat(path);
  if (stat?.isDirectory) {
    if (!url.pathname.endsWith("/")) {
      return redirect(
        url,
        `${sitePrefix}${parts.map(encodeURIComponent).join("/")}/`,
        config.redirectStatus,
        request.method,
      );
    }
    const index = filePath(path, ["index.html"]);
    if (!(await config.catalog.stat(index))?.isFile) {
      return plain("Not Found", 404, request.method);
    }
    return await previewFile(request, index);
  }
  if (!stat?.isFile) {
    return plain("Not Found", 404, request.method);
  }
  return await previewFile(request, path);
}

async function previewFile(request: Request, path: string): Promise<Response> {
  const response = await rawFile(request, path);
  if (response.headers.get("content-type")?.startsWith("text/html")) {
    response.headers.set("Content-Security-Policy", htmlPreviewCsp);
  }
  return response;
}
