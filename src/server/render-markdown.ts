import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions, markdownViewPageAction } from "./page-action.ts";
import type { PageAction } from "./page-action.ts";
import {
  renderCodeMarkdown,
  renderSourceCodeBlock,
} from "./render-code-markdown.ts";
import { codeLanguageForPath } from "./code-language.ts";
import { sourceAnnotations } from "./git/source.ts";
import { downloadFile, rawFile } from "./responses.ts";
import { metadataForFile } from "./file-metadata.ts";
import type { ServerConfig } from "./types.ts";

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
    ? renderSourceCodeBlock(
      text,
      codeLanguageForPath(file, text),
      await sourceAnnotations(config, file, text),
    )
    : renderCodeMarkdown(text, base.href);
  return htmlResponse(
    request,
    await page(config, {
      title: pathname,
      parts,
      directory: options.directory ?? false,
      content,
      url,
      actions: [
        ...filePageActions("text/plain; charset=UTF-8", metadata.mime),
        markdownViewPageAction(url, source),
        ...(options.actions ?? []),
      ],
      metadata,
      directoryView: options.directoryView,
      sourceName: options.sourceName,
    }),
  );
}

export type MarkdownOptions = {
  actions?: PageAction[];
  directory?: boolean;
  directoryView?: boolean;
  sourceName?: string;
};
