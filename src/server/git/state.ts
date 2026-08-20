import { relative } from "@std/path";
import type { ReloadSource } from "../reload-source.ts";
import { runGit } from "./command.ts";
import {
  mergeDiffAnnotations,
  type SourceLineAnnotation,
  untrackedAnnotations,
} from "./diff.ts";
import { type GitStatus, gitStatusAt, parseGitStatus } from "./status.ts";

export type GitState = {
  readonly root: string;
  readonly repositoryRoot: string;
  readonly subdirectory: string;
  readonly worktree: boolean;
  status(): Promise<GitStatus | undefined>;
  diff(
    path: string,
    lineCount: number,
  ): Promise<ReadonlyMap<number, SourceLineAnnotation> | undefined>;
  refresh(): Promise<void>;
};

export async function createGitState(
  root: string,
  reloadSource?: ReloadSource,
  ttlMs = 1_000,
): Promise<GitState | undefined> {
  if (
    Deno.permissions.querySync({ name: "run", command: "git" }).state !==
      "granted"
  ) {
    return undefined;
  }
  try {
    const inside = await runGit(root, ["rev-parse", "--is-inside-work-tree"]);
    const top = await runGit(root, ["rev-parse", "--show-toplevel"]);
    if (!inside.success || inside.stdout.trim() !== "true" || !top.success) {
      return undefined;
    }
    const repositoryRoot = top.stdout.trim();
    const state = new CachedGitState(
      root,
      repositoryRoot,
      relative(repositoryRoot, root),
      ttlMs,
    );
    reloadSource?.subscribe(() => state.refresh());
    await state.refresh();
    return state;
  } catch {
    return undefined;
  }
}

class CachedGitState implements GitState {
  #cached?: GitStatus;
  #updated = 0;
  #flight?: Promise<void>;
  readonly worktree = true;
  readonly root: string;
  readonly repositoryRoot: string;
  readonly subdirectory: string;
  readonly #servedRootPrefix: string;
  readonly #ttlMs: number;
  constructor(
    root: string,
    repositoryRoot: string,
    servedRootPrefix: string,
    ttlMs: number,
  ) {
    this.root = root;
    this.repositoryRoot = repositoryRoot;
    this.subdirectory = servedRootPrefix;
    this.#servedRootPrefix = servedRootPrefix;
    this.#ttlMs = ttlMs;
  }
  async status(): Promise<GitStatus | undefined> {
    if (!this.#cached || Date.now() - this.#updated > this.#ttlMs) {
      await this.refresh();
    }
    return this.#cached;
  }
  async refresh(): Promise<void> {
    if (this.#flight) return await this.#flight;
    this.#flight = this.load().finally(() => this.#flight = undefined);
    return await this.#flight;
  }
  async diff(
    path: string,
    lineCount: number,
  ): Promise<ReadonlyMap<number, SourceLineAnnotation> | undefined> {
    const status = await this.status();
    const located = gitStatusAt(status, path);
    const file = located && "status" in located ? located.status : located;
    if (!file || file.kind === "ignored") {
      return undefined;
    }
    if (file.index === "?" && file.worktree === "?") {
      return untrackedAnnotations(lineCount);
    }
    try {
      const [staged, unstaged] = await Promise.all([
        file.index === " " ? undefined : this.runDiff(path, true),
        file.worktree === " " ? undefined : this.runDiff(path, false),
      ]);
      if ((staged && !staged.success) || (unstaged && !unstaged.success)) {
        return undefined;
      }
      return mergeDiffAnnotations(staged?.stdout, unstaged?.stdout, lineCount);
    } catch {
      return undefined;
    }
  }
  async runDiff(path: string, cached: boolean) {
    return await runGit(this.root, [
      "diff",
      ...(cached ? ["--cached"] : []),
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--unified=0",
      "--",
      path,
    ]);
  }
  async load(): Promise<void> {
    const result = await runGit(this.root, [
      "status",
      "--porcelain=v1",
      "-z",
      "--branch",
      "--untracked-files=normal",
      "--ignored=matching",
      "--",
      ".",
    ]);
    if (!result.success) return;
    this.#cached = parseGitStatus(result.stdout, this.#servedRootPrefix);
    this.#updated = Date.now();
  }
}
