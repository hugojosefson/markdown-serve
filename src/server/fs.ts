export async function statOrUndefined(
  path: string,
): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof Deno.errors.NotADirectory
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function readDirectory(path: string): Promise<Deno.DirEntry[]> {
  return await Array.fromAsync(Deno.readDir(path));
}

export type DirectoryEntry = {
  name: string;
  directory: boolean;
  info: Deno.FileInfo | undefined;
};
