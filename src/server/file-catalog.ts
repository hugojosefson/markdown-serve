import { join } from "@std/path";
import { AsyncLimiter } from "./async-limiter.ts";
import {
  type DirectoryEntry,
  lstatOrUndefined,
  readDirectory,
  readLinkOrUndefined,
  statOrUndefined,
} from "./fs.ts";
import type { FileAccess } from "./file-access.ts";
import {
  indexCandidates,
  markdownCandidates,
  selectedIndex,
} from "./entry-route.ts";
import { lexical } from "./paths.ts";

export type IndexState =
  | { known: false }
  | { known: true; index: string | undefined };

export type SymlinkInfo = { info: Deno.FileInfo; target: string };

export class FileCatalog {
  #directories = new Map<string, Promise<DirectoryEntry[]>>();
  #names = new Map<string, Promise<Deno.DirEntry[]>>();
  #stats = new Map<string, Promise<Deno.FileInfo | undefined>>();
  #symlinks = new Map<string, Promise<SymlinkInfo | undefined>>();
  #indexes = new Map<string, Promise<string | undefined>>();
  #indexStates = new Map<string, string | undefined>();
  #markdown = new Map<string, Promise<string | undefined>>();
  #statLimiter = new AsyncLimiter(16);
  #readLimiter = new AsyncLimiter(16);
  #generation = 0;

  constructor(readonly access?: FileAccess) {}

  names(path: string): Promise<Deno.DirEntry[]> {
    return this.#names.get(path) ?? this.#setNames(path);
  }

  entries(path: string): Promise<DirectoryEntry[]> {
    return this.#directories.get(path) ?? this.#setDirectory(path);
  }

  stat(
    path: string,
    directoryHint = false,
  ): Promise<Deno.FileInfo | undefined> {
    return this.#stats.get(path) ?? this.#setStat(path, directoryHint);
  }

  symlink(path: string): Promise<SymlinkInfo | undefined> {
    return this.#symlinks.get(path) ?? this.#setSymlink(path);
  }

  index(path: string): Promise<string | undefined> {
    return this.#indexes.get(path) ?? this.#setIndex(path);
  }

  indexState(path: string): IndexState {
    return this.#indexStates.has(path)
      ? { known: true, index: this.#indexStates.get(path) }
      : { known: false };
  }

  async warmRoot(rootPath: string): Promise<void> {
    const entries = await this.entries(rootPath);
    await Promise.all([
      this.index(rootPath),
      ...entries.filter((entry) => entry.directory).map((entry) =>
        this.index(join(rootPath, entry.name))
      ),
    ]);
  }

  async markdown(path: string, leaf: string): Promise<string | undefined> {
    const key = `${path}\0${leaf}`;
    return await (this.#markdown.get(key) ??
      this.#setMarkdown(key, path, leaf));
  }

  async markdownDenied(path: string, leaf: string): Promise<boolean> {
    const access = this.access;
    if (!access) return false;
    const names = await this.#namesIfDirectory(path);
    if (!names) return false;
    return markdownCandidates(names.map((entry) => entry.name), leaf).some(
      (name) => access.isDenied(join(path, name)),
    );
  }

  clear(): void {
    this.#generation++;
    this.#directories.clear();
    this.#names.clear();
    this.#stats.clear();
    this.#symlinks.clear();
    this.#indexes.clear();
    this.#indexStates.clear();
    this.#markdown.clear();
  }

  #setMarkdown(
    key: string,
    path: string,
    leaf: string,
  ): Promise<string | undefined> {
    const value = this.#resolveMarkdown(path, leaf);
    this.#markdown.set(key, value);
    return value;
  }

  async #resolveMarkdown(
    path: string,
    leaf: string,
  ): Promise<string | undefined> {
    const exact = `${leaf}.md`;
    if ((await this.stat(join(path, exact)))?.isFile) {
      return exact;
    }
    const names = await this.#namesIfDirectory(path);
    if (!names) {
      return undefined;
    }
    const candidates = markdownCandidates(
      names.map((entry) => entry.name),
      leaf,
    )
      .filter((name) => name !== exact);
    const files = await Promise.all(
      candidates.map(async (name) =>
        (await this.stat(join(path, name)))?.isFile ? name : undefined
      ),
    );
    return files.filter((name): name is string => name !== undefined)[0];
  }

  async #namesIfDirectory(path: string): Promise<Deno.DirEntry[] | undefined> {
    try {
      return await this.names(path);
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

  #setDirectory(path: string): Promise<DirectoryEntry[]> {
    const generation = this.#generation;
    const access = this.access;
    const value = this.names(path).then(async (names) => {
      const entries = await Promise.all(names.map(async (entry) => {
        const child = join(path, entry.name);
        const [info, symlink] = await Promise.all([
          this.stat(child, entry.isDirectory),
          entry.isSymlink ? this.symlink(child) : undefined,
        ]);
        if (entry.isDirectory && access) {
          await this.#readLimiter.run(() => access.probeDirectory(child));
        }
        return {
          name: entry.name,
          directory: info?.isDirectory ?? entry.isDirectory,
          symlink: entry.isSymlink,
          ...(symlink ? { target: symlink.target } : {}),
          ...(entry.isSymlink && !info && !access?.isDenied(child)
            ? { broken: true }
            : {}),
          info,
        };
      }));
      const sorted = entries.toSorted((left, right) =>
        lexical(left.name, right.name)
      );
      if (generation === this.#generation) {
        const index = selectedIndex(sorted);
        this.#indexes.set(path, Promise.resolve(index));
        this.#setIndexState(path, index);
      }
      return sorted;
    });
    this.#directories.set(path, value);
    return value;
  }
  #setStat(
    path: string,
    directoryHint = false,
  ): Promise<Deno.FileInfo | undefined> {
    const value = this.#statLimiter.run(() =>
      this.access
        ? this.access.stat(path, directoryHint)
        : statOrUndefined(path)
    );
    this.#stats.set(path, value);
    return value;
  }
  #setSymlink(path: string): Promise<SymlinkInfo | undefined> {
    const value = this.#readLimiter.run(() =>
      resolveSymlink(this.access, path)
    );
    this.#symlinks.set(path, value);
    return value;
  }
  #setIndex(path: string): Promise<string | undefined> {
    const generation = this.#generation;
    const value = this.names(path).then(async (names) => {
      const candidates = indexCandidates(names.map((entry) => entry.name));
      const entries = await Promise.all(candidates.map(async (name) => {
        const info = await this.stat(join(path, name));
        return {
          name,
          directory: info?.isDirectory ?? false,
          symlink: false,
          info,
        };
      }));
      const index = selectedIndex(entries);
      if (generation === this.#generation) {
        this.#setIndexState(path, index);
      }
      return index;
    });
    this.#indexes.set(path, value);
    return value;
  }

  #setNames(path: string): Promise<Deno.DirEntry[]> {
    const value = this.#readLimiter.run(() =>
      this.access ? this.access.readDirectory(path) : readDirectory(path)
    );
    this.#names.set(path, value);
    return value;
  }

  #setIndexState(path: string, index: string | undefined): void {
    this.#indexStates.set(path, index);
  }
}

async function resolveSymlink(
  access: FileAccess | undefined,
  path: string,
): Promise<SymlinkInfo | undefined> {
  try {
    const info = await (access?.lstat(path) ?? lstatOrUndefined(path));
    if (!info?.isSymlink) return undefined;
    const target = await (access?.readLink(path) ?? readLinkOrUndefined(path));
    return target === undefined ? undefined : { info, target };
  } catch {
    return undefined;
  }
}
