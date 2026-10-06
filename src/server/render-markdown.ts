import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions, savedEditHref } from "./page-action.ts";
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
import { editableFile, formEdit } from "./edit-response.ts";
import { editorModel, relativeEditPath } from "./editor-model.ts";
import { viewedFileTarget } from "./active-file-poller.ts";
import { renderEmptyFile } from "./render-empty-file.ts";

export async function renderMarkdown(
  config: ServerConfig,
  request: Request,
  pathname: string,
  file: string,
  parts: string[],
  options: MarkdownOptions = {},
): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "POST" && url.searchParams.has("edit")) {
    return await postEdit(config, request, url, file, pathname, parts, options);
  }
  if (url.searchParams.has("raw")) {
    return await rawFile(request, file, true);
  }
  if (new URL(request.url).searchParams.has("download")) {
    return await downloadFile(request, file);
  }
  const requestedEdit = url.searchParams.has("edit");
  const requestedEditable = requestedEdit && config.edit
    ? await editableFile(config.rootPath, file)
    : false;
  if (requestedEdit && !requestedEditable) {
    return new Response("Not Found", { status: 404 });
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const info = await Deno.stat(file);
  const metadata = metadataForFile(file, info);
  const base = new URL(request.url);
  base.pathname = pathname;
  base.search = "";
  const bytes = await Deno.readFile(file);
  const text = new TextDecoder().decode(bytes);
  const editPath = config.edit &&
      (requestedEditable || await editableFile(config.rootPath, file))
    ? relativeEditPath(config, file)
    : undefined;
  const view = requestedEdit
    ? "edit" as const
    : url.searchParams.has("source")
    ? "source"
    : "rendered";
  const content = view !== "edit" && bytes.length === 0
    ? renderEmptyFile()
    : view === "edit"
    ? ""
    : view === "source"
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
      markdownView: view,
      directoryView: options.directoryView,
      sourceName: options.sourceName,
      editPath,
      reloadTarget: viewedFileTarget(config.rootPath, file, info),
      ...(view === "edit"
        ? editorModel(
          config,
          file,
          bytes,
          text,
          {
            baseUrl: url.href,
            status: url.searchParams.has("saved") ? "Saved" : undefined,
          },
        )
        : {}),
    }),
  );
}

async function postEdit(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  pathname: string,
  parts: string[],
  options: MarkdownOptions,
): Promise<Response> {
  if (!config.edit || !await editableFile(config.rootPath, file)) {
    return new Response("Not Found", { status: 404 });
  }
  const result = await formEdit(config, request, url, file);
  if (result.kind === "saved") {
    return new Response(null, {
      status: 303,
      headers: { Location: savedEditHref(url) },
    });
  }
  if (result.kind === "conflict") {
    return await markdownEditPage(
      config,
      request,
      url,
      pathname,
      parts,
      options,
      file,
      result.text,
      result.tag,
      "Conflict: merge the current version before saving",
      409,
      result.currentText,
    );
  }
  return new Response(result.message, { status: result.status });
}

async function markdownEditPage(
  config: ServerConfig,
  request: Request,
  url: URL,
  pathname: string,
  parts: string[],
  options: MarkdownOptions,
  file: string,
  text: string,
  tag: string,
  status: string,
  responseStatus: number,
  currentText?: string,
): Promise<Response> {
  const info = await Deno.stat(file);
  const metadata = metadataForFile(file, info);
  const body = await page(config, {
    title: pathname,
    parts,
    directory: options.directory ?? false,
    content: "",
    url,
    headerActions: options.headerActions,
    fileActions: filePageActions("text/plain; charset=UTF-8", metadata.mime),
    fileActionPlacement: "heading",
    metadata,
    markdownView: "edit",
    directoryView: options.directoryView,
    sourceName: options.sourceName,
    reloadTarget: viewedFileTarget(config.rootPath, file, info),
    ...editorModel(
      config,
      file,
      new Uint8Array(),
      text,
      { baseUrl: url.href, currentText, status, tag },
    ),
  });
  return new Response(request.method === "HEAD" ? null : body, {
    status: responseStatus,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export type MarkdownOptions = {
  headerActions?: HeaderAction[];
  directory?: boolean;
  directoryView?: boolean;
  sourceName?: string;
};
