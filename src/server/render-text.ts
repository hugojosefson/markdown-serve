import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions, htmlPageAction } from "./page-action.ts";
import { fileMime, metadataForFile, textFileMime } from "./file-metadata.ts";
import { renderSourceCodeBlockWithSymbols } from "./render-code-markdown.ts";
import { sourceAnnotations } from "./git/source.ts";
import type { ServerConfig } from "./types.ts";
import { relative } from "@std/path";
import { editableFile } from "./edit-response.ts";

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
  const content = await renderSourceCodeBlockWithSymbols(
    text,
    codeLanguageForPath(file, text),
    await sourceAnnotations(config, file, text),
    await config.symbols?.targets(),
  );
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: false,
      content,
      url,
      fileActionPlacement: "toolbar",
      fileActions: [
        ...(isHtml(file) ? [htmlPageAction(parts)] : []),
        ...filePageActions("text/plain; charset=UTF-8", fileMime(file)),
      ],
      metadata: { ...metadataForFile(file, info), mime: textFileMime(file) },
      editPath: config.edit && await editableFile(config.rootPath, file)
        ? relative(config.rootPath, file).split(/[/\\]/).join("/")
        : undefined,
    }),
  );
}

function isHtml(path: string): boolean {
  return /\.html?$/i.test(path) || fileMime(path).startsWith("text/html");
}
