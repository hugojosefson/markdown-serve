import { relative } from "@std/path";
import { codeLanguageForPath } from "./code-language.ts";
import { editTag } from "./edit-response.ts";
import type { PageModel } from "./page-model.ts";
import { renderHighlightedCode } from "./render-code-markdown.ts";
import type { ServerConfig } from "./types.ts";

export type EditorModel = Pick<
  PageModel,
  | "editCurrentText"
  | "editHighlight"
  | "editPath"
  | "editStatus"
  | "editTag"
  | "editText"
>;

export function editorModel(
  config: ServerConfig,
  file: string,
  bytes: Uint8Array,
  text: string,
  status?: string,
  currentText?: string,
  tag = editTag(bytes),
): EditorModel {
  return {
    editPath: relativeEditPath(config, file),
    editText: text,
    editTag: tag,
    editStatus: status,
    editHighlight: renderHighlightedCode(
      text,
      codeLanguageForPath(file, text),
    ),
    editCurrentText: currentText,
  };
}

export function relativeEditPath(config: ServerConfig, file: string): string {
  return relative(config.rootPath, file).replaceAll("\\", "/");
}
