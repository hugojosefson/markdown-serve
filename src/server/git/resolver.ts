import { isAbsolute, join, relative, resolve, SEPARATOR } from "@std/path";
import type { ReloadSource } from "../reload-source.ts";
import { AsyncLimiter } from "../async-limiter.ts";
import type { ServerConfig } from "../types.ts";
import { createGitState, type GitState } from "./state.ts";

type CachedDiscovery = {
  expires: number;
  state: Promise<GitState | undefined>;
};

/** Discovers repositories lazily from directories within one served root. */
export class GitResolver {
  #states = new Map<string, CachedDiscovery>();
  #limiter = new AsyncLimiter(4);
  readonly #reloadInvalidates: boolean;

  constructor(
    readonly root: string,
    reloadSource?: ReloadSource,
    readonly ttlMs = 1_000,
  ) {
    this.#reloadInvalidates = Boolean(reloadSource);
    reloadSource?.subscribe(() => this.clear());
  }

  state(path: string): Promise<GitState | undefined> {
    const directory = resolve(path);
    if (!within(directory, this.root)) {
      return Promise.resolve(undefined);
    }
    const cached = this.#states.get(directory);
    if (cached && cached.expires > Date.now()) {
      this.#states.delete(directory);
      this.#states.set(directory, cached);
      return cached.state;
    }
    this.#states.delete(directory);
    const entry: CachedDiscovery = {
      expires: Infinity,
      state: Promise.resolve(undefined),
    };
    entry.state = this.#limiter.run(() =>
      createGitState(directory, undefined, this.ttlMs, this.root)
    ).then((state) => {
      entry.expires = state && this.#reloadInvalidates
        ? Infinity
        : Date.now() + this.ttlMs;
      return state;
    });
    this.#states.set(directory, entry);
    this.#trim();
    return entry.state;
  }

  childState(
    parent: string,
    child: string,
  ): Promise<GitState | undefined> {
    const parentState = this.state(parent);
    return Deno.lstat(join(child, ".git")).then(
      () => this.state(child),
      (error) =>
        error instanceof Deno.errors.NotFound ||
          error instanceof Deno.errors.NotADirectory
          ? parentState
          : this.state(child),
    );
  }

  clear(): void {
    this.#states.clear();
  }

  #trim(): void {
    while (this.#states.size > 1_024) {
      const oldest = this.#states.keys().next().value;
      if (oldest === undefined) return;
      this.#states.delete(oldest);
    }
  }
}

/** Uses on-demand discovery when available, retaining legacy static configs. */
export async function gitStateAt(
  config: ServerConfig,
  directory: string,
): Promise<GitState | undefined> {
  return config.gitResolver
    ? await config.gitResolver.state(directory)
    : config.git;
}

export async function gitStateAtChild(
  config: ServerConfig,
  parent: string,
  child: string,
): Promise<GitState | undefined> {
  return config.gitResolver
    ? await config.gitResolver.childState(parent, child)
    : config.git;
}

function within(path: string, root: string): boolean {
  const relation = relative(resolve(root), path);
  return relation === "" ||
    (!isAbsolute(relation) && relation !== ".." &&
      !relation.startsWith(`..${SEPARATOR}`));
}
