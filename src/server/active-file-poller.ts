import { relative } from "@std/path";

export type StatOperation = (path: string) => Promise<Deno.FileInfo>;

type TrackedFile = {
  references: number;
  revision: string;
  checking?: Promise<void>;
};

/** A compact, transport-safe stat fingerprint for rendered files. */
export function fileRevision(info: Deno.FileInfo): string {
  const time = (value: Date | null) => value?.getTime() ?? -1;
  const inode = typeof info.ino === "number" ? info.ino : -1;
  const type = info.isFile ? 1 : info.isDirectory ? 2 : info.isSymlink ? 3 : 0;
  return [type, info.size, time(info.mtime), time(info.ctime), inode].join(",");
}

export function validFileRevision(value: string): boolean {
  return /^-?\d+(,-?\d+){4}$/.test(value) && value.length <= 256;
}

export function viewedFileTarget(
  root: string,
  path: string,
  info: Deno.FileInfo,
): { path: string; revision: string } {
  return {
    path: relative(root, path).replaceAll("\\", "/"),
    revision: fileRevision(info),
  };
}

/** Polls only files represented by active generated-page SSE connections. */
export class ActiveFilePoller {
  #files = new Map<string, TrackedFile>();
  #timer?: ReturnType<typeof setInterval>;
  #closed = false;

  constructor(
    readonly changed: () => void,
    readonly stat: StatOperation = Deno.stat,
    readonly intervalMs = 1_000,
  ) {}

  track(path: string, renderedRevision: string): () => void {
    if (this.#closed) return () => {};
    const tracked = this.#files.get(path);
    if (tracked) {
      tracked.references++;
      if (tracked.revision !== renderedRevision) this.#changed();
    } else {
      this.#files.set(path, { references: 1, revision: renderedRevision });
      this.#start();
    }
    void this.checkPath(path).catch(() => {});
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      const current = this.#files.get(path);
      if (!current) return;
      current.references--;
      if (current.references === 0) this.#files.delete(path);
      if (this.#files.size === 0) this.#stop();
    };
  }

  async check(): Promise<void> {
    await Promise.all(
      [...this.#files.keys()].map((path) => this.checkPath(path)),
    );
  }

  close(): void {
    this.#closed = true;
    this.#files.clear();
    this.#stop();
  }

  async checkPath(path: string): Promise<void> {
    const tracked = this.#files.get(path);
    if (!tracked) return;
    if (tracked.checking) return await tracked.checking;
    const checking = this.#checkPath(path, tracked).finally(() => {
      if (this.#files.get(path) === tracked) tracked.checking = undefined;
    });
    tracked.checking = checking;
    await checking;
  }

  async #checkPath(path: string, tracked: TrackedFile): Promise<void> {
    const revision = await this.#revision(path);
    if (revision === undefined || this.#files.get(path) !== tracked) return;
    if (revision !== tracked.revision) {
      tracked.revision = revision;
      this.#changed();
    }
  }

  async #revision(path: string): Promise<string | undefined> {
    try {
      return fileRevision(await this.stat(path));
    } catch (error) {
      if (error instanceof Deno.errors.NotFound) return "missing";
      if (
        error instanceof Deno.errors.PermissionDenied ||
        error instanceof Deno.errors.NotCapable
      ) return "denied";
      return undefined;
    }
  }

  #start(): void {
    if (this.#timer !== undefined) return;
    this.#timer = setInterval(
      () => void this.check().catch(() => {}),
      this.intervalMs,
    );
  }

  #changed(): void {
    try {
      this.changed();
    } catch {
      // A notification failure must not stop future polling.
    }
  }

  #stop(): void {
    if (this.#timer === undefined) return;
    clearInterval(this.#timer);
    this.#timer = undefined;
  }
}
