import { isAbsolute, join, relative } from "@std/path";
import { readCapped } from "./capped-stream.ts";
import { entryRoute } from "./entry-route.ts";
import { canonicalPath } from "./paths.ts";
import { childTerminator } from "./terminate-child.ts";
import type { FileAccess } from "./file-access.ts";

const maximumResults = 100;
const maximumContext = 8;
const maximumOutputBytes = 512 * 1024;
export type ContentSearchOptions = {
  query: string;
  fixed: boolean;
  smartCase: boolean;
  glob?: string;
  type?: string;
  hidden: boolean;
  ignored: boolean;
  context: number;
};
export type ContentSearchResult = {
  path: string;
  line: number;
  text: string;
  context: { line: number; text: string }[];
  href: string;
};
export type ContentSearchRunner = (
  scope: string,
  options: ContentSearchOptions,
  signal?: AbortSignal,
  onPermissionDenied?: (path: string) => void,
) => Promise<ContentSearchResult[]>;
export type RgChild = {
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  status: Promise<Deno.CommandStatus>;
  kill(signal?: Deno.Signal): void;
};
export type RgSpawner = (args: string[], cwd: string) => RgChild;
export class SearchUnavailable extends Error {}

export function contentSearchOptions(
  params: URLSearchParams,
): ContentSearchOptions | undefined {
  const query = params.get("search");
  const string = (name: string) => {
    const value = params.get(name);
    return value === null
      ? undefined
      : value.length && value.length <= 100
      ? value
      : undefined;
  };
  const rawContext = params.get("context");
  const context = Number(rawContext ?? "0");
  if (
    query === null || !query.length || query.length > 500 ||
    rawContext === "" ||
    !Number.isInteger(context) || context < 0 || context > maximumContext
  ) return undefined;
  const flag = (name: string) => {
    const value = params.get(name);
    return value === null || value === "0"
      ? false
      : value === "1"
      ? true
      : undefined;
  };
  const fixed = flag("fixed"),
    smartCase = flag("smartCase"),
    hidden = flag("hidden"),
    ignored = flag("ignored");
  if (
    [fixed, smartCase, hidden, ignored].some((value) => value === undefined) ||
    (params.has("glob") && !string("glob")) ||
    (params.has("type") && !string("type"))
  ) return undefined;
  return {
    query,
    fixed: fixed!,
    smartCase: smartCase!,
    glob: string("glob"),
    type: string("type"),
    hidden: hidden!,
    ignored: ignored!,
    context,
  };
}

export async function searchContent(
  root: string,
  parts: string[],
  options: ContentSearchOptions,
  runner: ContentSearchRunner,
  signal?: AbortSignal,
  access?: FileAccess,
): Promise<ContentSearchResult[]> {
  const scope = join(root, ...parts);
  if (!(await within(root, scope))) return [];
  if (access) {
    if (!await access.probeDirectory(scope)) return [];
  }
  const results = await runner(scope, options, signal, (path) => {
    const normalized = normalize(path);
    const deniedPath = isAbsolute(path)
      ? path
      : safe(normalized)
      ? join(scope, normalized)
      : undefined;
    if (deniedPath) {
      access?.handlePermissionDenied(
        deniedPath,
        new Deno.errors.PermissionDenied(),
        true,
      );
    }
  });
  return (await Promise.all(
    results.filter((result) => typeof result.text === "string" && result.text)
      .slice(0, maximumResults).map(
        async (result) => {
          const path = normalize(result.path);
          if (
            !safe(path) || !Number.isSafeInteger(result.line) ||
            result.line < 1 || !(await within(root, join(scope, path)))
          ) return undefined;
          const all = [...parts, ...path.split("/")];
          const route = entryRoute(all.slice(0, -1), {
            name: all.at(-1)!,
            directory: false,
          });
          const markdown = all.at(-1)!.toLowerCase().endsWith(".md");
          const context = Array.isArray(result.context)
            ? result.context.filter((line) =>
              Number.isSafeInteger(line?.line) && line.line > 0 &&
              typeof line.text === "string"
            ).slice(0, maximumContext * 2)
            : [];
          return {
            ...result,
            path,
            context,
            href: `${canonicalPath(route.parts, route.trailing)}${
              markdown ? "?source" : ""
            }#L${result.line}`,
          };
        },
      ),
  )).filter((result): result is ContentSearchResult => result !== undefined);
}

export const runRg: ContentSearchRunner = createRgRunner((args, cwd) =>
  new Deno.Command("rg", {
    args,
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn()
);
export function createRgRunner(
  spawn: RgSpawner,
  limits = { timeoutMilliseconds: 1_500, outputBytes: maximumOutputBytes },
): ContentSearchRunner {
  return async (scope, options, signal, onPermissionDenied) => {
    if (signal?.aborted) throw new SearchUnavailable("search cancelled");
    let child: RgChild;
    try {
      child = spawn(rgArgs(options), scope);
    } catch {
      throw new SearchUnavailable("rg unavailable");
    }
    const terminator = childTerminator(child);
    let failure: Error | undefined;
    const outputAbort = new AbortController();
    const stop = (error: Error) => {
      if (failure) return;
      failure = error;
      outputAbort.abort();
      terminator.stop();
    };
    const timer = setTimeout(
      () => stop(new SearchUnavailable("search timed out")),
      limits.timeoutMilliseconds,
    );
    const abort = () => stop(new SearchUnavailable("search cancelled"));
    signal?.addEventListener("abort", abort, { once: true });
    try {
      const [stdout, stderr, status] = await Promise.all([
        readCapped(
          child.stdout,
          limits.outputBytes,
          () => stop(new SearchUnavailable("search output exceeded limit")),
          outputAbort.signal,
        ),
        readCapped(
          child.stderr,
          limits.outputBytes,
          () =>
            stop(new SearchUnavailable("search error output exceeded limit")),
          outputAbort.signal,
        ),
        terminator.status,
      ]);
      if (failure) throw failure;
      const denied = permissionDeniedPaths(stderr);
      for (const path of denied) onPermissionDenied?.(path);
      if (status?.code === 1 && !stderr.trim()) return [];
      if (!status?.success && !denied.length) {
        throw new SearchUnavailable("rg failed");
      }
      if (!status?.success && !permissionOnly(stderr)) {
        throw new SearchUnavailable("rg failed");
      }
      return parseRgOutput(new TextEncoder().encode(stdout));
    } catch (error) {
      if (failure) throw failure;
      const unavailable = error instanceof SearchUnavailable
        ? error
        : new SearchUnavailable("rg unavailable");
      stop(unavailable);
      throw unavailable;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  };
}

function permissionDeniedPaths(stderr: string): string[] {
  return stderr.split("\n").flatMap((line) => {
    if (!/permission denied \(os error 13\)$/i.test(line)) return [];
    const operation = /operation on (.+): permission denied/i.exec(line)?.[1];
    const direct = /^rg: (.+): permission denied/i.exec(line)?.[1];
    return [operation ?? direct].filter((path): path is string => !!path);
  });
}

function permissionOnly(stderr: string): boolean {
  return stderr.trim().split("\n").every((line) =>
    !line || /permission denied \(os error 13\)$/i.test(line)
  );
}
export function rgArgs(options: ContentSearchOptions): string[] {
  const args = [
    "--json",
    "--line-number",
    "--no-heading",
    "--max-columns",
    "2000",
    "--",
    options.query,
    ".",
  ];
  if (options.fixed) args.unshift("--fixed-strings");
  if (options.smartCase) args.unshift("--smart-case");
  if (options.hidden) args.unshift("--hidden");
  if (options.ignored) args.unshift("--no-ignore");
  if (options.context) args.unshift("--context", String(options.context));
  if (options.glob) args.unshift("--glob", options.glob);
  if (options.type) args.unshift("--type", options.type);
  return args;
}
export function parseRgOutput(bytes: Uint8Array): ContentSearchResult[] {
  const results: ContentSearchResult[] = [];
  const contexts = new Map<string, { line: number; text: string }[]>();
  for (const line of new TextDecoder().decode(bytes).split("\n")) {
    try {
      const value = JSON.parse(line);
      const data = value.data;
      const path = typeof data?.path?.text === "string"
        ? data.path.text
        : undefined;
      const text = typeof data?.lines?.text === "string"
        ? data.lines.text.replace(/\r?\n$/, "")
        : undefined;
      const number = data?.line_number;
      if (
        value.type === "match" && path && text !== undefined &&
        Number.isSafeInteger(number)
      ) {
        results.push({ path, line: number, text, context: [], href: "" });
      } else if (
        value.type === "context" && path &&
        text !== undefined && Number.isSafeInteger(number)
      ) {
        contexts.set(path, [...(contexts.get(path) ?? []), {
          line: number,
          text,
        }]);
      }
    } catch { /* malformed rg JSON */ }
  }
  for (const result of results) {
    result.context = (contexts.get(result.path) ?? []).filter((line) =>
      Math.abs(line.line - result.line) <= maximumContext
    ).slice(0, maximumContext * 2);
  }
  return results.slice(0, maximumResults);
}
function normalize(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "");
}
function safe(path: string): boolean {
  return path !== "" && !path.startsWith("/") &&
    path.split("/").every((part) => part && part !== "." && part !== "..");
}
async function within(root: string, path: string): Promise<boolean> {
  try {
    const value = relative(
      await Deno.realPath(root),
      await Deno.realPath(path),
    );
    return value === "" ||
      (!value.startsWith("../") && !value.startsWith("..\\") &&
        value !== ".." && !isAbsolute(value));
  } catch {
    return false;
  }
}
