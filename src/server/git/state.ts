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
  head(path: string): Promise<string | undefined>;
  refresh(): Promise<void>;
};

export async function createGitState(
  root: string,
  reloadSource?: ReloadSource,
  ttlMs = 1_000,
  servedRoot = root,
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
      servedRoot,
      repositoryRoot,
      relative(repositoryRoot, servedRoot),
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
  readonly #nestedPrefix: string;
  readonly #scope: string;
  readonly #repositoryPrefix: string;
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
    this.#repositoryPrefix = repositoryPrefix(root, repositoryRoot);
    this.#servedRootPrefix = this.#repositoryPrefix.startsWith("../") ||
        this.#repositoryPrefix === ".."
      ? ""
      : this.#repositoryPrefix;
    this.#nestedPrefix = this.#servedRootPrefix
      ? ""
      : relative(root, repositoryRoot).replaceAll("\\", "/");
    this.#scope = this.#servedRootPrefix;
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
  async head(path: string): Promise<string | undefined> {
    const normalized = path.replaceAll("\\", "/");
    if (
      !normalized || normalized.startsWith("/") ||
      normalized.split("/").includes("..")
    ) {
      return undefined;
    }
    const repositoryPath = this.repositoryPath(normalized);
    if (!repositoryPath) {
      return undefined;
    }
    try {
      const result = await runGit(
        this.repositoryRoot,
        ["show", `HEAD:${repositoryPath}`],
        {
          maxOutputBytes: 1024 * 1024,
        },
      );
      if (result.success) {
        return result.stdout;
      }
      const located = gitStatusAt(await this.status(), normalized);
      const file = located && "status" in located ? located.status : located;
      return file?.index === "?" && file.worktree === "?" ? "" : undefined;
    } catch {
      return undefined;
    }
  }
  async runDiff(path: string, cached: boolean) {
    const repositoryPath = this.repositoryPath(path);
    if (!repositoryPath) {
      return { success: false, stdout: "", stderr: "" };
    }
    return await runGit(this.repositoryRoot, [
      "diff",
      ...(cached ? ["--cached"] : []),
      "--no-ext-diff",
      "--no-textconv",
      "--no-color",
      "--unified=0",
      "--",
      repositoryPath,
    ]);
  }
  async load(): Promise<void> {
    const result = await runGit(this.repositoryRoot, [
      "status",
      "--porcelain=v1",
      "-z",
      "--branch",
      "--untracked-files=normal",
      "--ignored=matching",
      "--",
      this.#scope || ".",
    ]);
    if (!result.success) {
      this.#cached = undefined;
      this.#updated = Date.now();
      return;
    }
    this.#cached = parseGitStatus(
      result.stdout,
      this.#servedRootPrefix,
      this.#nestedPrefix,
    );
    this.#updated = Date.now();
  }

  repositoryPath(path: string): string | undefined {
    const normalized = path.replaceAll("\\", "/");
    if (
      !normalized || normalized.startsWith("/") ||
      normalized.split("/").includes("..")
    ) {
      return undefined;
    }
    if (this.#nestedPrefix) {
      return normalized === this.#nestedPrefix
        ? "."
        : normalized.startsWith(`${this.#nestedPrefix}/`)
        ? normalized.slice(this.#nestedPrefix.length + 1)
        : undefined;
    }
    return this.#servedRootPrefix
      ? `${this.#servedRootPrefix.replaceAll("\\", "/")}/${normalized}`
      : normalized;
  }
}

function repositoryPrefix(root: string, repositoryRoot: string): string {
  const relation = relative(repositoryRoot, root).replaceAll("\\", "/");
  return relation === "" ? "" : relation;
}
