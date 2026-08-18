import { join } from "@std/path";

export function decodePath(pathname: string): string[] | undefined {
  return resolveParts(pathname, decodeURIComponent);
}

export function splitPath(path: string): string[] | undefined {
  return resolveParts(path, (part) => part);
}

function resolveParts(
  path: string,
  decode: (part: string) => string,
): string[] | undefined {
  try {
    return path.split("/").filter(Boolean).map((part) => {
      const decoded = decode(part);
      if (
        !decoded || decoded === "." || decoded === ".." ||
        decoded.includes("/") || decoded.includes("\\") ||
        decoded.includes("\0")
      ) {
        throw new Error("invalid path");
      }
      return decoded;
    });
  } catch {
    return undefined;
  }
}

export function filePath(root: string, parts: string[]): string {
  return join(root, ...parts);
}

export function canonicalPath(parts: string[], trailing = false): string {
  return `/${parts.map(encodeURIComponent).join("/")}${trailing ? "/" : ""}`;
}

export function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
