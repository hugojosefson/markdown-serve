import { join } from "@std/path";
import { lexical } from "./paths.ts";

export async function statOrUndefined(
  path: string,
): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    }
    throw error;
  }
}

export async function readDirectory(path: string): Promise<Deno.DirEntry[]> {
  return await Array.fromAsync(Deno.readDir(path));
}

export async function directoryEntries(
  path: string,
): Promise<Array<{ name: string; directory: boolean }>> {
  const entries = await readDirectory(path);
  const resolved = await Promise.all(entries.map(async (entry) => ({
    name: entry.name,
    directory: (await statOrUndefined(join(path, entry.name)))?.isDirectory ??
      false,
  })));
  return resolved.sort((left, right) => lexical(left.name, right.name));
}
