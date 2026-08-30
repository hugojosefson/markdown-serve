export async function statOrUndefined(
  path: string,
): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch (error) {
    if (
      error instanceof Deno.errors.NotFound ||
      error instanceof Deno.errors.NotADirectory ||
      error instanceof Deno.errors.FilesystemLoop
    ) {
      return undefined;
    }
    throw error;
  }
}

export async function readDirectory(path: string): Promise<Deno.DirEntry[]> {
  return await Array.fromAsync(Deno.readDir(path));
}

export async function lstatOrUndefined(
  path: string,
): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.lstat(path);
  } catch {
    return undefined;
  }
}

export async function readLinkOrUndefined(
  path: string,
): Promise<string | undefined> {
  try {
    return await Deno.readLink(path);
  } catch {
    return undefined;
  }
}

export type DirectoryEntry = {
  name: string;
  directory: boolean;
  symlink: boolean;
  target?: string;
  broken?: boolean;
  info: Deno.FileInfo | undefined;
};
