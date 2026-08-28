import { join, relative } from "@std/path";
import { entryRoute } from "./entry-route.ts";
import { canonicalPath, lexical } from "./paths.ts";
import { readCapped } from "./capped-stream.ts";
import { childTerminator } from "./terminate-child.ts";
import { FileAccess } from "./file-access.ts";
import { type GitStatus, gitStatusAt } from "./git/status.ts";
import type { ServerConfig } from "./types.ts";

const maximumResults = 200;
const maximumCandidates = 10_000;
const maximumEntries = 10_000;
const maximumOutputBytes = 512 * 1024;
const finderTimeoutMilliseconds = 1_500;

export type FileSearchResult = { name: string; path: string; href: string };
export type FinderRunner = (
  finders: ("fd" | "fdfind")[],
  root: string,
  query: string,
  signal?: AbortSignal,
) => Promise<string[]>;
export type FinderChild = {
  stdout: ReadableStream<Uint8Array>;
  status: Promise<Deno.CommandStatus>;
  kill(signal?: Deno.Signal): void;
};
export type FinderSpawner = (
  finder: "fd" | "fdfind",
  root: string,
  query: string,
) => FinderChild;

export async function searchFiles(
  config: ServerConfig,
  query: string,
  signal?: AbortSignal,
): Promise<FileSearchResult[]> {
  if (signal?.aborted) return [];
  const statusPromise = config.git?.status().catch(() => undefined);
  const paths = config.finders?.length
    ? await (config.finderRunner ?? searchedByFinder)(
      config.finders,
      config.rootPath,
      query,
      signal,
    ).catch(() => undefined)
    : undefined;
  if (signal?.aborted) return [];
  const status = await statusPromise;
  const names = paths
    ? await normalizeFinderPaths(
      config,
      paths.toSorted((a, b) => compareSearchPaths(a, b, status)),
      query,
      signal,
    )
    : await searchedByCatalog(config, query, signal);
  return names.toSorted((a, b) => compareSearchPaths(a, b, status)).slice(
    0,
    maximumResults,
  ).map(resultFor);
}

function resultFor(name: string): FileSearchResult {
  const directory = name.endsWith("/");
  const parts = name.replace(/\/$/, "").split("/");
  const route = entryRoute(parts.slice(0, -1), {
    name: parts.at(-1)!,
    directory,
  });
  return { name, path: name, href: canonicalPath(route.parts, route.trailing) };
}

async function searchedByFinder(
  finders: ("fd" | "fdfind")[],
  root: string,
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (signal?.aborted) throw new Error("finder cancelled");
  let error: unknown;
  for (const finder of finders) {
    try {
      return await runFinder(finder, root, query, signal);
    } catch (caught) {
      error = caught;
      if (signal?.aborted) throw caught;
    }
  }
  throw error;
}

const runFinder = createFinderRunner((finder, root, query) =>
  new Deno.Command(finder, {
    args: [
      "--type",
      "file",
      "--type",
      "directory",
      "--hidden",
      "--no-ignore",
      "--ignore-case",
      "--full-path",
      "--exclude",
      ".git",
      "--print0",
      "--max-results",
      String(maximumCandidates),
      "--",
      subsequenceRegex(query),
    ],
    cwd: root,
    stdin: "null",
    stdout: "piped",
    stderr: "null",
  }).spawn()
);

export function createFinderRunner(
  spawn: FinderSpawner,
  limits = {
    timeoutMilliseconds: finderTimeoutMilliseconds,
    outputBytes: maximumOutputBytes,
  },
): (
  finder: "fd" | "fdfind",
  root: string,
  query: string,
  signal?: AbortSignal,
) => Promise<string[]> {
  return async (finder, root, query, signal) => {
    if (signal?.aborted) throw new Error("finder cancelled");
    const child = spawn(finder, root, query);
    const terminator = childTerminator(child);
    let failure: Error | undefined;
    const outputAbort = new AbortController();
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      outputAbort.abort();
      terminator.stop();
    };
    const timeout = setTimeout(
      () => stop(new Error("finder unavailable")),
      limits.timeoutMilliseconds,
    );
    const abort = () => stop(new Error("finder unavailable"));
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const [output, status] = await Promise.all([
        readCapped(
          child.stdout,
          limits.outputBytes,
          () => stop(new Error("finder unavailable")),
          outputAbort.signal,
        ),
        terminator.status,
      ]);
      if (failure || !status?.success || signal?.aborted) {
        throw failure ?? new Error("finder unavailable");
      }
      return parseFinderOutput(new TextEncoder().encode(output));
    } catch (error) {
      if (!failure) {
        stop(error instanceof Error ? error : new Error("finder unavailable"));
      }
      throw failure;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    }
  };
}

export function parseFinderOutput(output: Uint8Array): string[] {
  return new TextDecoder().decode(output).split("\0").filter(Boolean)
    .map((path) => path.replaceAll("\\", "/").replace(/^\.\//, ""))
    .filter((path) => safeRelativePath(path.replace(/\/$/, "")))
    .slice(0, maximumCandidates);
}

async function normalizeFinderPaths(
  config: ServerConfig,
  paths: string[],
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const results: string[] = [];
  for (const path of paths) {
    if (signal?.aborted || results.length === maximumResults) break;
    const normalized = path.replace(/\/$/, "");
    if (
      !safeRelativePath(normalized) || !subsequenceMatch(path, query)
    ) continue;
    const candidate = join(config.rootPath, normalized);
    const link = await (config.access ?? new FileAccess(config.rootPath)).lstat(
      candidate,
    );
    if (!link || link.isSymlink) continue;
    const info = await config.catalog.stat(candidate);
    if (info?.isFile) results.push(normalized);
    if (info?.isDirectory && normalized !== ".git") {
      results.push(`${normalized}/`);
    }
  }
  return results;
}

async function searchedByCatalog(
  config: ServerConfig,
  query: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const results: string[] = [];
  const { rootPath: root } = config;
  const access = config.access ?? new FileAccess(root);
  const pending = [root];
  let examined = 0;
  while (pending.length && examined < maximumEntries) {
    if (signal?.aborted) break;
    const directory = pending.pop()!;
    try {
      for (const entry of await access.readDirectory(directory)) {
        if (
          signal?.aborted || ++examined > maximumEntries
        ) break;
        if (entry.isSymlink || (entry.isDirectory && entry.name === ".git")) {
          continue;
        }
        const path = join(directory, entry.name);
        const name = relative(root, path).replaceAll("\\", "/") +
          (entry.isDirectory ? "/" : "");
        if (entry.isDirectory) {
          pending.push(path);
        }
        if (
          (entry.isDirectory || entry.isFile) &&
          safeRelativePath(name.replace(/\/$/, "")) &&
          subsequenceMatch(name, query)
        ) {
          results.push(name);
        }
      }
    } catch (error) {
      if (!transientDirectoryError(error)) throw error;
    }
  }
  return results;
}

export function subsequenceMatch(path: string, query: string): boolean {
  const expected = [...query.toLowerCase()];
  let index = 0;
  for (const character of path.toLowerCase()) {
    if (character === expected[index]) index++;
  }
  return index === expected.length;
}

function compareSearchPaths(
  a: string,
  b: string,
  status?: GitStatus,
): number {
  return ignoredRank(a, status) - ignoredRank(b, status) ||
    hiddenRank(a) - hiddenRank(b) || lexical(a, b);
}

function ignoredRank(path: string, status?: GitStatus): number {
  const normalized = path.replace(/\/$/, "");
  return gitStatusAt(status, normalized)?.kind === "ignored" ? 1 : 0;
}

function hiddenRank(path: string): number {
  return path.replace(/\/$/, "").split("/").some((part) => part.startsWith("."))
    ? 1
    : 0;
}

function subsequenceRegex(query: string): string {
  return [...query].map((character) =>
    character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")
  ).join(".*");
}

function transientDirectoryError(error: unknown): boolean {
  return error instanceof Deno.errors.NotFound ||
    error instanceof Deno.errors.NotADirectory ||
    error instanceof Deno.errors.PermissionDenied;
}

function safeRelativePath(path: string): boolean {
  return path !== "" && !path.startsWith("/") &&
    path.split("/").every((part) =>
      part !== "" && part !== "." && part !== ".."
    );
}
