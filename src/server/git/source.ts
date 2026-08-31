import { dirname, relative } from "@std/path";
import type { ServerConfig } from "../types.ts";
import type { SourceLineAnnotation } from "./diff.ts";
import { gitStateAt } from "./resolver.ts";

export async function sourceAnnotations(
  config: ServerConfig,
  file: string,
  text: string,
): Promise<ReadonlyMap<number, SourceLineAnnotation> | undefined> {
  const path = relative(config.rootPath, file).replaceAll("\\", "/");
  if (!path || path === ".." || path.startsWith("../")) {
    return undefined;
  }
  const git = await gitStateAt(config, dirname(file));
  return await git?.diff(path, text.split("\n").length);
}
