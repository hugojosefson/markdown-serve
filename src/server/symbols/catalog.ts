import { join, relative, SEPARATOR_PATTERN } from "@std/path";
import { codeLanguageForPath } from "../code-language.ts";
import { classifyEntry, entryRoute } from "../entry-route.ts";
import { canonicalPath } from "../paths.ts";
import { analyzeSymbols } from "./analyze.ts";
import { declarationTypes } from "./declaration-rules.ts";
import type { SymbolTargets } from "./types.ts";
import type { FileAccess } from "../file-access.ts";

const maxFileBytes = 1024 * 1024;
const defaultLimits = {
  maxTraversalEntries: 10_000,
  maxSupportedFiles: 1_000,
  maxTotalBytes: 64 * 1024 * 1024,
} as const;

export type SymbolCatalogLimits = {
  maxTraversalEntries?: number;
  maxSupportedFiles?: number;
  maxTotalBytes?: number;
  maxFileBytes?: number;
};

/** Lazily indexes source declarations; reload invalidation makes targets fresh. */
export class SymbolCatalog {
  #targets: Promise<SymbolTargets> | undefined;
  readonly #limits: Required<SymbolCatalogLimits>;

  constructor(
    readonly rootPath: string,
    limits: SymbolCatalogLimits = {},
    readonly access?: FileAccess,
  ) {
    this.#limits = { ...defaultLimits, maxFileBytes, ...limits };
  }

  targets(): Promise<SymbolTargets> {
    return this.#targets ??= this.#build();
  }

  clear(): void {
    this.#targets = undefined;
  }

  async #build(): Promise<SymbolTargets> {
    const declarations: { name: string; href: string }[] = [];
    const state = {
      entries: 0,
      supportedFiles: 0,
      totalBytes: 0,
      truncated: false,
    };
    for await (
      const path of sourceFiles(this.rootPath, state, this.#limits, this.access)
    ) {
      const info = await statOrUndefined(path, this.access);
      if (!info?.isFile) {
        continue;
      }
      if (info.size > this.#limits.maxFileBytes) continue;
      const pathLanguage = codeLanguageForPath(path);
      // Known unsupported formats need no content sniffing.
      if (pathLanguage !== "text" && !declarationTypes(pathLanguage)) continue;
      const text = await readTextOrUndefined(path, this.access);
      if (text === undefined) {
        continue;
      }
      const language = codeLanguageForPath(path, text);
      if (!declarationTypes(language)) continue;
      state.supportedFiles++;
      state.totalBytes += info.size;
      if (
        state.supportedFiles > this.#limits.maxSupportedFiles ||
        state.totalBytes > this.#limits.maxTotalBytes
      ) {
        state.truncated = true;
        break;
      }
      const analysis = await analyzeSymbols(text, language);
      if (!analysis) continue;
      const href = sourceHref(this.rootPath, path);
      for (const occurrence of analysis.occurrences) {
        if (occurrence.declaration) {
          declarations.push({
            name: occurrence.name,
            href: `${href}#symbol-${encodeURIComponent(occurrence.name)}`,
          });
        }
      }
    }
    if (state.truncated) return new Map();
    const counts = new Map<string, number>();
    for (const declaration of declarations) {
      counts.set(declaration.name, (counts.get(declaration.name) ?? 0) + 1);
    }
    return new Map(
      declarations.flatMap((declaration) =>
        counts.get(declaration.name) === 1
          ? [[declaration.name, declaration.href] as const]
          : []
      ),
    );
  }
}

async function statOrUndefined(
  path: string,
  access?: FileAccess,
): Promise<Deno.FileInfo | undefined> {
  try {
    return access ? await access.stat(path) : await Deno.stat(path);
  } catch {
    return undefined;
  }
}

async function* sourceFiles(
  path: string,
  state: { entries: number; truncated: boolean },
  limits: Required<SymbolCatalogLimits>,
  access?: FileAccess,
): AsyncGenerator<string> {
  try {
    const entries = access
      ? await access.readDirectory(path)
      : await Array.fromAsync(Deno.readDir(path));
    for (const entry of entries) {
      state.entries++;
      if (state.entries > limits.maxTraversalEntries) {
        state.truncated = true;
        return;
      }
      if (
        entry.isDirectory && !entry.isSymlink &&
        [".git", ".hg", ".svn"].includes(entry.name)
      ) {
        continue;
      }
      const child = join(path, entry.name);
      if (entry.isDirectory && !entry.isSymlink) {
        yield* sourceFiles(child, state, limits, access);
        if (state.truncated) return;
      } else if (entry.isFile) {
        yield child;
      }
    }
  } catch (error) {
    access?.handlePermissionDenied(path, error, true);
    return;
  }
}

async function readTextOrUndefined(
  path: string,
  access?: FileAccess,
): Promise<string | undefined> {
  try {
    return access
      ? await access.readTextFile(path)
      : await Deno.readTextFile(path);
  } catch {
    return undefined;
  }
}

function sourceHref(rootPath: string, path: string): string {
  const parts = relative(rootPath, path).split(SEPARATOR_PATTERN);
  const entry = { name: parts.at(-1)!, directory: false };
  const route = entryRoute(parts.slice(0, -1), entry);
  const href = canonicalPath(route.parts, route.trailing);
  return classifyEntry(entry).markdown ? `${href}?source` : href;
}
