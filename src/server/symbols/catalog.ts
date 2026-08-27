import { join, relative, SEPARATOR_PATTERN } from "@std/path";
import { codeLanguageForPath } from "../code-language.ts";
import { classifyEntry, entryRoute } from "../entry-route.ts";
import { canonicalPath } from "../paths.ts";
import { analyzeSymbols } from "./analyze.ts";
import { declarationTypes } from "./declaration-rules.ts";
import type { SymbolTargets } from "./types.ts";

const maxBytes = 1024 * 1024;

/** Lazily indexes source declarations; reload invalidation makes targets fresh. */
export class SymbolCatalog {
  #targets: Promise<SymbolTargets> | undefined;

  constructor(readonly rootPath: string) {}

  targets(): Promise<SymbolTargets> {
    return this.#targets ??= this.#build();
  }

  clear(): void {
    this.#targets = undefined;
  }

  async #build(): Promise<SymbolTargets> {
    const declarations: { name: string; href: string }[] = [];
    for await (const path of sourceFiles(this.rootPath)) {
      const info = await statOrUndefined(path);
      if (!info?.isFile || info.size > maxBytes) continue;
      const pathLanguage = codeLanguageForPath(path);
      // Known unsupported formats need no content sniffing.
      if (pathLanguage !== "text" && !declarationTypes(pathLanguage)) continue;
      const text = await readTextOrUndefined(path);
      if (text === undefined) continue;
      const language = codeLanguageForPath(path, text);
      if (!declarationTypes(language)) continue;
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
): Promise<Deno.FileInfo | undefined> {
  try {
    return await Deno.stat(path);
  } catch {
    return undefined;
  }
}

async function* sourceFiles(path: string): AsyncGenerator<string> {
  let entries: Deno.DirEntry[];
  try {
    entries = await Array.fromAsync(Deno.readDir(path));
  } catch {
    return;
  }
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory && !entry.isSymlink) {
      yield* sourceFiles(child);
    } else if (entry.isFile) {
      yield child;
    }
  }
}

async function readTextOrUndefined(path: string): Promise<string | undefined> {
  try {
    return await Deno.readTextFile(path);
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
