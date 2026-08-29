import { codeLanguageForPath } from "./code-language.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import {
  filePageActions,
  htmlPageAction,
  savedEditHref,
} from "./page-action.ts";
import { fileMime, metadataForFile, textFileMime } from "./file-metadata.ts";
import { renderSourceCodeBlockWithSymbols } from "./render-code-markdown.ts";
import { sourceAnnotations } from "./git/source.ts";
import type { ServerConfig } from "./types.ts";
import { editableFile, formEdit } from "./edit-response.ts";
import {
  type EditorModel,
  editorModel,
  relativeEditPath,
} from "./editor-model.ts";
import { viewedFileTarget } from "./active-file-poller.ts";
import { renderEmptyFile } from "./render-empty-file.ts";

export async function renderText(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
): Promise<Response> {
  const editing = url.searchParams.has("edit");
  if (request.method === "POST" && editing) {
    return await postTextEdit(config, request, url, file, parts);
  }
  const requestedEditable = editing && config.edit
    ? await editableFile(config.rootPath, file)
    : false;
  if (editing && !requestedEditable) {
    return new Response("Not Found", { status: 404 });
  }
  if (request.method === "HEAD") {
    return htmlResponse(request, "");
  }
  const info = await Deno.stat(file);
  const bytes = await Deno.readFile(file);
  const text = new TextDecoder().decode(bytes);
  const content = editing
    ? ""
    : bytes.length === 0
    ? renderEmptyFile()
    : await renderSourceCodeBlockWithSymbols(
      text,
      codeLanguageForPath(file, text),
      await sourceAnnotations(config, file, text),
      await config.symbols?.targets(),
    );
  const editor = editing
    ? editorModel(
      config,
      file,
      bytes,
      text,
      { status: url.searchParams.has("saved") ? "Saved" : undefined },
    )
    : undefined;
  return await textPage(
    config,
    request,
    url,
    file,
    parts,
    content,
    editor,
    200,
    info,
  );
}

async function textPage(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
  content: string,
  editor?: EditorModel,
  status = 200,
  renderedInfo?: Deno.FileInfo,
): Promise<Response> {
  const info = renderedInfo ?? await Deno.stat(file);
  const editable = config.edit && await editableFile(config.rootPath, file);
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
      editPath: editable ? relativeEditPath(config, file) : undefined,
      editView: Boolean(editor),
      reloadTarget: viewedFileTarget(config.rootPath, file, info),
      ...editor,
    }),
    status,
  );
}

async function postTextEdit(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
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
  if (result.kind === "invalid") {
    return new Response(result.message, { status: result.status });
  }
  return await textPage(
    config,
    request,
    url,
    file,
    parts,
    "",
    editorModel(
      config,
      file,
      new Uint8Array(),
      result.text,
      {
        currentText: result.currentText,
        status: "Conflict: merge the current version before saving",
        tag: result.tag,
      },
    ),
    409,
  );
}

function isHtml(path: string): boolean {
  return /\.html?$/i.test(path) || fileMime(path).startsWith("text/html");
}
