import { relative } from "@std/path";
import type { ServerConfig } from "../types.ts";
import type { SourceLineAnnotation } from "./diff.ts";

export async function sourceAnnotations(
  config: ServerConfig,
  file: string,
  text: string,
): Promise<ReadonlyMap<number, SourceLineAnnotation> | undefined> {
  const path = relative(config.rootPath, file).replaceAll("\\", "/");
  if (!config.git || !path || path === ".." || path.startsWith("../")) {
    return undefined;
  }
  return await config.git.diff(path, text.split("\n").length);
}
