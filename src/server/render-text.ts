import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions } from "./page-action.ts";
import { fileMime, metadataForFile, textFileMime } from "./file-metadata.ts";
import { renderSourceCodeBlock } from "./render-code-markdown.ts";
import { sourceAnnotations } from "./git/source.ts";
import type { ServerConfig } from "./types.ts";

export async function renderText(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
): Promise<Response> {
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const text = await Deno.readTextFile(file);
  const info = await Deno.stat(file);
  const content = renderSourceCodeBlock(
    text,
    codeLanguageForPath(file, text),
    await sourceAnnotations(config, file, text),
  );
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: false,
      content,
      url,
      actions: filePageActions(
        "text/plain; charset=UTF-8",
        fileMime(file),
      ),
      metadata: { ...metadataForFile(file, info), mime: textFileMime(file) },
    }),
  );
}
