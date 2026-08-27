import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions } from "./page-action.ts";
import type { HeaderAction } from "./page-action.ts";
import {
  renderCodeMarkdown,
  renderSourceCodeBlockWithSymbols,
} from "./render-code-markdown.ts";
import { codeLanguageForPath } from "./code-language.ts";
import { sourceAnnotations } from "./git/source.ts";
import { downloadFile, rawFile } from "./responses.ts";
import { metadataForFile } from "./file-metadata.ts";
import type { ServerConfig } from "./types.ts";
import { renderMarkdownToc } from "./markdown-toc.ts";

export async function renderMarkdown(
  config: ServerConfig,
  request: Request,
  pathname: string,
  file: string,
  parts: string[],
  options: MarkdownOptions = {},
): Promise<Response> {
  if (new URL(request.url).searchParams.has("raw")) {
    return await rawFile(request, file, true);
  }
  if (new URL(request.url).searchParams.has("download")) {
    return await downloadFile(request, file);
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const info = await Deno.stat(file);
  const metadata = metadataForFile(file, info);
  const base = new URL(request.url);
  base.pathname = pathname;
  base.search = "";
  const text = await Deno.readTextFile(file);
  const url = new URL(request.url);
  const source = url.searchParams.has("source");
  const content = source
    ? await renderSourceCodeBlockWithSymbols(
      text,
      codeLanguageForPath(file, text),
      await sourceAnnotations(config, file, text),
      await config.symbols?.targets(),
    )
    : renderMarkdownToc(renderCodeMarkdown(text, base.href));
  return htmlResponse(
    request,
    await page(config, {
      title: pathname,
      parts,
      directory: options.directory ?? false,
      content,
      url,
      headerActions: options.headerActions,
      fileActions: filePageActions("text/plain; charset=UTF-8", metadata.mime),
      fileActionPlacement: "heading",
      metadata,
      sourceExpanded: source,
      directoryView: options.directoryView,
      sourceName: options.sourceName,
    }),
  );
}

export type MarkdownOptions = {
  headerActions?: HeaderAction[];
  directory?: boolean;
  directoryView?: boolean;
  sourceName?: string;
};
