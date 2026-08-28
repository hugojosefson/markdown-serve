import { relative } from "@std/path";
import { codeLanguageForPath } from "./code-language.ts";
import { editTag } from "./edit-response.ts";
import type { PageModel } from "./page-model.ts";
import {
  renderCodeMarkdown,
  renderHighlightedCode,
} from "./render-code-markdown.ts";
import type { ServerConfig } from "./types.ts";

export type EditorModel = Pick<
  PageModel,
  | "editCurrentText"
  | "editHighlight"
  | "editPath"
  | "editPreview"
  | "editStatus"
  | "editTag"
  | "editText"
>;

export function editorModel(
  config: ServerConfig,
  file: string,
  bytes: Uint8Array,
  text: string,
  options: EditorModelOptions = {},
): EditorModel {
  const language = codeLanguageForPath(file, text);
  return {
    editPath: relativeEditPath(config, file),
    editText: text,
    editTag: options.tag ?? editTag(bytes),
    editStatus: options.status,
    editHighlight: renderHighlightedCode(text, language),
    editPreview: language === "markdown" && options.baseUrl
      ? renderCodeMarkdown(text, options.baseUrl)
      : undefined,
    editCurrentText: options.currentText,
  };
}

type EditorModelOptions = {
  baseUrl?: string;
  currentText?: string;
  status?: string;
  tag?: string;
};

export function relativeEditPath(config: ServerConfig, file: string): string {
  return relative(config.rootPath, file).replaceAll("\\", "/");
}
