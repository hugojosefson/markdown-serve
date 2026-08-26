import { fromFileUrl, join } from "@std/path";

export function packageSourcePaths(moduleUrl: string | URL): string[] {
  const sourceUrl = new URL(moduleUrl);
  if (sourceUrl.protocol !== "file:") {
    return [];
  }
  const packageRoot = fromFileUrl(new URL("../../", sourceUrl));
  return [
    fromFileUrl(new URL("../", sourceUrl)),
    join(packageRoot, "deno.json"),
    join(packageRoot, "deno.lock"),
  ];
}
