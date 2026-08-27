import { isAbsolute, join, relative } from "@std/path";
import { entryRoute } from "./entry-route.ts";
import { canonicalPath, lexical } from "./paths.ts";
import { readCapped } from "./capped-stream.ts";
import { childTerminator } from "./terminate-child.ts";
import type { ServerConfig } from "./types.ts";

const maximumResults = 200;
const maximumEntries = 10_000;
const maximumOutputBytes = 512 * 1024;
const finderTimeoutMilliseconds = 1_500;

export type FileSearchResult = { name: string; path: string; href: string };
export type FinderRunner = (
  finders: ("fd" | "fdfind")[],
  scope: string,
  signal?: AbortSignal,
) => Promise<string[]>;
export type FinderChild = {
  stdout: ReadableStream<Uint8Array>;
  status: Promise<Deno.CommandStatus>;
  kill(signal?: Deno.Signal): void;
};
export type FinderSpawner = (
  finder: "fd" | "fdfind",
  scope: string,
) => FinderChild;

export async function searchFiles(
  config: ServerConfig,
  scopeParts: string[],
  signal?: AbortSignal,
): Promise<FileSearchResult[]> {
  if (signal?.aborted) return [];
  const scope = join(config.rootPath, ...scopeParts);
  const info = await config.catalog.stat(scope);
  if (!info?.isDirectory || !(await scopeWithinRoot(config.rootPath, scope))) {
    return [];
  }
  const paths = config.finders?.length
    ? await (config.finderRunner ?? searchedByFinder)(
      config.finders,
      scope,
      signal,
    ).catch(() => undefined)
    : undefined;
  if (signal?.aborted) return [];
  const names = paths ?? await searchedByCatalog(scope, signal);
  return names.map((name) => resultFor(scopeParts, name)).toSorted((a, b) =>
    lexical(a.path, b.path)
  );
}

function resultFor(scope: string[], name: string): FileSearchResult {
  const parts = name.split("/");
  const route = entryRoute([...scope, ...parts.slice(0, -1)], {
    name: parts.at(-1)!,
    directory: false,
  });
  return { name, path: name, href: canonicalPath(route.parts, route.trailing) };
}

async function searchedByFinder(
  finders: ("fd" | "fdfind")[],
  scope: string,
  signal?: AbortSignal,
): Promise<string[]> {
  if (signal?.aborted) throw new Error("finder cancelled");
  let error: unknown;
  for (const finder of finders) {
    try {
      return await runFinder(finder, scope, signal);
    } catch (caught) {
      error = caught;
      if (signal?.aborted) throw caught;
    }
  }
  throw error;
}

const runFinder = createFinderRunner((finder, scope) =>
  new Deno.Command(finder, {
    args: [
      "--type",
      "file",
      "--hidden",
      "--print0",
      "--max-results",
      String(maximumResults),
      ".",
    ],
    cwd: scope,
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
  scope: string,
  signal?: AbortSignal,
) => Promise<string[]> {
  return async (finder, scope, signal) => {
    if (signal?.aborted) throw new Error("finder cancelled");
    const child = spawn(finder, scope);
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
    .filter(safeRelativePath)
    .slice(0, maximumResults);
}

async function searchedByCatalog(
  scope: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const results: string[] = [];
  const pending = [scope];
  let examined = 0;
  while (
    pending.length && results.length < maximumResults &&
    examined < maximumEntries
  ) {
    if (signal?.aborted) break;
    const directory = pending.pop()!;
    try {
      for await (const entry of Deno.readDir(directory)) {
        if (
          signal?.aborted || results.length >= maximumResults ||
          ++examined > maximumEntries
        ) break;
        if (entry.isSymlink || (entry.isDirectory && entry.name === ".git")) {
          continue;
        }
        const path = join(directory, entry.name);
        if (entry.isDirectory) {
          pending.push(path);
        } else if (entry.isFile) {
          const name = relative(scope, path).replaceAll("\\", "/");
          if (safeRelativePath(name)) results.push(name);
        }
      }
    } catch (error) {
      if (!transientDirectoryError(error)) throw error;
    }
  }
  return results;
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

async function scopeWithinRoot(root: string, scope: string): Promise<boolean> {
  try {
    const path = relative(
      await Deno.realPath(root),
      await Deno.realPath(scope),
    );
    return path === "" ||
      (!(path === ".." || path.startsWith("../") || path.startsWith("..\\")) &&
        !isAbsolute(path));
  } catch {
    return false;
  }
}
