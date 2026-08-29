import { isAbsolute, relative, resolve, SEPARATOR } from "@std/path";

export type FileAccessOperations = {
  stat: (path: string) => Promise<Deno.FileInfo>;
  lstat: (path: string) => Promise<Deno.FileInfo>;
  readDirectory: (path: string) => Promise<Deno.DirEntry[]>;
  readFile: (path: string) => Promise<Uint8Array>;
  readTextFile: (path: string) => Promise<string>;
  open: (path: string) => Promise<Deno.FsFile>;
};

/** Per-handler filesystem access policy for paths below the configured root. */
export class FileAccess {
  #warned = new Set<string>();
  #deniedFiles = new Set<string>();
  #deniedDirectories = new Set<string>();
  readonly #root: string;

  constructor(
    rootPath: string,
    readonly warn = console.warn,
    readonly operations: Partial<FileAccessOperations> = {},
  ) {
    this.#root = resolve(rootPath);
  }

  handlePermissionDenied(
    path: string,
    error: unknown,
    directory = false,
  ): boolean {
    const normalized = resolve(path);
    if (
      !this.#withinRoot(normalized) ||
      !(
        error instanceof Deno.errors.PermissionDenied ||
        error instanceof Deno.errors.NotCapable
      ) ||
      normalized === this.#root
    ) {
      return false;
    }
    if (this.#belowDeniedDirectory(normalized)) return true;
    if (directory) {
      this.#deniedDirectories.add(normalized);
    } else {
      this.#deniedFiles.add(normalized);
    }
    if (!this.#warned.has(normalized)) {
      this.#warned.add(normalized);
      this.warn(
        `Cannot access ${relative(this.#root, normalized)}: permission denied`,
      );
    }
    return true;
  }

  /** Reload retries access while retaining lifetime warning deduplication. */
  clearDenied(): void {
    this.#deniedFiles.clear();
    this.#deniedDirectories.clear();
  }

  isDenied(path: string): boolean {
    const normalized = resolve(path);
    return this.#deniedFiles.has(normalized) ||
      this.#belowDeniedDirectory(normalized);
  }

  async stat(
    path: string,
    directoryHint = false,
  ): Promise<Deno.FileInfo | undefined> {
    return await this.#undefined(
      path,
      () => (this.operations.stat ?? Deno.stat)(path),
      directoryHint,
    );
  }

  async lstat(path: string): Promise<Deno.FileInfo | undefined> {
    return await this.#undefined(
      path,
      () => (this.operations.lstat ?? Deno.lstat)(path),
    );
  }

  async readDirectory(path: string): Promise<Deno.DirEntry[]> {
    if (this.#belowDeniedDirectory(resolve(path))) return [];
    try {
      return await (this.operations.readDirectory?.(path) ??
        Array.fromAsync(Deno.readDir(path)));
    } catch (error) {
      if (this.handlePermissionDenied(path, error, true)) return [];
      throw error;
    }
  }

  async probeDirectory(path: string): Promise<boolean> {
    if (this.#belowDeniedDirectory(resolve(path))) return false;
    try {
      if (this.operations.readDirectory) {
        await this.operations.readDirectory(path);
      } else {
        for await (const _entry of Deno.readDir(path)) break;
      }
      return true;
    } catch (error) {
      if (this.handlePermissionDenied(path, error, true)) return false;
      if (
        error instanceof Deno.errors.NotFound ||
        error instanceof Deno.errors.NotADirectory ||
        error instanceof Deno.errors.FilesystemLoop
      ) return false;
      throw error;
    }
  }

  async readFile(path: string): Promise<Uint8Array | undefined> {
    return await this.#undefined(
      path,
      () => (this.operations.readFile ?? Deno.readFile)(path),
    );
  }

  async readTextFile(path: string): Promise<string | undefined> {
    return await this.#undefined(
      path,
      () => (this.operations.readTextFile ?? Deno.readTextFile)(path),
    );
  }

  async open(path: string): Promise<Deno.FsFile | undefined> {
    return await this.#undefined(
      path,
      () => (this.operations.open ?? Deno.open)(path),
    );
  }

  async #undefined<T>(
    path: string,
    operation: () => Promise<T>,
    directoryHint = false,
  ): Promise<T | undefined> {
    if (this.#belowDeniedDirectory(resolve(path))) return undefined;
    try {
      const value = await operation();
      this.#deniedFiles.delete(resolve(path));
      return value;
    } catch (error) {
      if (this.handlePermissionDenied(path, error, directoryHint)) {
        return undefined;
      }
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

  #belowDeniedDirectory(path: string): boolean {
    return [...this.#deniedDirectories].some((directory) =>
      path === directory || path.startsWith(`${directory}${SEPARATOR}`)
    );
  }

  #withinRoot(path: string): boolean {
    const value = relative(this.#root, path);
    return value === "" ||
      (value !== ".." && !value.startsWith(`..${SEPARATOR}`) &&
        !isAbsolute(value));
  }
}
