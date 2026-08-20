import { join } from "@std/path";
import { AsyncLimiter } from "./async-limiter.ts";
import { type DirectoryEntry, readDirectory, statOrUndefined } from "./fs.ts";
import {
  indexCandidates,
  markdownCandidates,
  selectedIndex,
} from "./entry-route.ts";
import { lexical } from "./paths.ts";

export type IndexState =
  | { known: false }
  | { known: true; index: string | undefined };

export class FileCatalog {
  #directories = new Map<string, Promise<DirectoryEntry[]>>();
  #names = new Map<string, Promise<Deno.DirEntry[]>>();
  #stats = new Map<string, Promise<Deno.FileInfo | undefined>>();
  #indexes = new Map<string, Promise<string | undefined>>();
  #indexStates = new Map<string, string | undefined>();
  #markdown = new Map<string, Promise<string | undefined>>();
  #statLimiter = new AsyncLimiter(16);
  #readLimiter = new AsyncLimiter(16);
  #generation = 0;

  names(path: string): Promise<Deno.DirEntry[]> {
    return this.#names.get(path) ?? this.#setNames(path);
  }

  entries(path: string): Promise<DirectoryEntry[]> {
    return this.#directories.get(path) ?? this.#setDirectory(path);
  }

  stat(path: string): Promise<Deno.FileInfo | undefined> {
    return this.#stats.get(path) ?? this.#setStat(path);
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

  clear(): void {
    this.#generation++;
    this.#directories.clear();
    this.#names.clear();
    this.#stats.clear();
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
    const value = this.names(path).then(async (names) => {
      const entries = await Promise.all(names.map(async (entry) => {
        const info = await this.stat(join(path, entry.name));
        return {
          name: entry.name,
          directory: info?.isDirectory ?? false,
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
  #setStat(path: string): Promise<Deno.FileInfo | undefined> {
    const value = this.#statLimiter.run(() => statOrUndefined(path));
    this.#stats.set(path, value);
    return value;
  }
  #setIndex(path: string): Promise<string | undefined> {
    const generation = this.#generation;
    const value = this.names(path).then(async (names) => {
      const candidates = indexCandidates(names.map((entry) => entry.name));
      const entries = await Promise.all(candidates.map(async (name) => {
        const info = await this.stat(join(path, name));
        return { name, directory: info?.isDirectory ?? false, info };
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
    const value = this.#readLimiter.run(() => readDirectory(path));
    this.#names.set(path, value);
    return value;
  }

  #setIndexState(path: string, index: string | undefined): void {
    this.#indexStates.set(path, index);
  }
}
