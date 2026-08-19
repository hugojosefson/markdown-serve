import { contentType } from "@std/media-types";
import { basename } from "@std/path";

const SAMPLE_SIZE = 8192;
const sourceExtensions = new Set([
  ".bash",
  ".c",
  ".cc",
  ".cpp",
  ".cjs",
  ".cs",
  ".cts",
  ".css",
  ".go",
  ".h",
  ".html",
  ".java",
  ".js",
  ".json",
  ".json5",
  ".jsonc",
  ".jsx",
  ".md",
  ".mjs",
  ".mts",
  ".py",
  ".rs",
  ".sh",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
  ".zsh",
]);

export async function isTextFile(path: string): Promise<boolean> {
  const type = contentType(extension(path));
  if (type && !isTextMime(type) && !sourceExtensions.has(extension(path))) {
    return false;
  }
  const file = await Deno.open(path);
  try {
    const sample = new Uint8Array(SAMPLE_SIZE);
    const bytesRead = await file.read(sample) ?? 0;
    return isUtf8Text(sample.subarray(0, bytesRead), bytesRead === SAMPLE_SIZE);
  } finally {
    file.close();
  }
}

function isTextMime(type: string): boolean {
  return type.startsWith("text/") || type.includes("json") ||
    type.includes("xml") ||
    type.includes("javascript");
}

function isUtf8Text(sample: Uint8Array, truncated: boolean): boolean {
  for (const byte of sample) {
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20) || byte === 0x7f) {
      return false;
    }
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(sample, {
      stream: truncated,
    });
    return ![...text].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return (codePoint > 0x0d && codePoint < 0x20) ||
        (codePoint >= 0x7f && codePoint <= 0x9f);
    });
  } catch {
    return false;
  }
}

function extension(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  return index < 0 ? "" : name.slice(index).toLowerCase();
}
