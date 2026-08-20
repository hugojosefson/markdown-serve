import { Parser } from "web-tree-sitter";
import { declarationTypes, symbolGrammar } from "./declaration-rules.ts";
import { loadLanguage } from "./engine.ts";
import { syntaxDeclarations } from "./syntax-declarations.ts";
import type {
  SymbolAnalysis,
  SymbolDeclarationLink,
  SymbolOccurrence,
} from "./types.ts";
import * as wasms from "./wasms.js";

const maxBytes = 1024 * 1024;
const modules = wasms as unknown as Readonly<
  Record<string, WebAssembly.Module>
>;
const cache = new Map<
  string,
  Promise<Awaited<ReturnType<typeof loadLanguage>>>
>();

export async function analyzeSymbols(
  text: string,
  language: string,
): Promise<SymbolAnalysis | undefined> {
  const grammarName = symbolGrammar(language);
  const types = declarationTypes(language);
  if (
    !grammarName || !types ||
    new TextEncoder().encode(text).byteLength > maxBytes
  ) return;
  try {
    const grammar = modules[grammarName];
    if (!grammar) return;
    const loaded = cache.get(grammarName) ?? loadLanguage(grammar);
    cache.set(grammarName, loaded);
    const languageGrammar = await loaded;
    const parser = new Parser();
    parser.setLanguage(languageGrammar);
    let tree: ReturnType<Parser["parse"]>;
    try {
      tree = parser.parse(text);
    } catch {
      parser.delete();
      return;
    }
    if (!tree) {
      parser.delete();
      return;
    }
    try {
      return analysis(syntaxDeclarations(tree.rootNode, text, types));
    } finally {
      tree.delete();
      parser.delete();
    }
  } catch {
    return;
  }
}

function analysis(
  found: ReturnType<typeof syntaxDeclarations>,
): SymbolAnalysis {
  const counts = new Map<string, number>();
  for (const item of found) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  const occurrences: SymbolOccurrence[] = found.map((item) => ({
    ...item,
    declaration: true,
    href: counts.get(item.name) === 1
      ? `#symbol-${encodeURIComponent(item.name)}`
      : `#L${item.line}`,
    id: counts.get(item.name) === 1 ? `symbol-${item.name}` : undefined,
  }));
  return {
    occurrences,
    declarationLines: new Set(found.map((item) => item.line)),
    declarationLinks: lineLinks(occurrences),
  };
}

function lineLinks(
  occurrences: readonly SymbolOccurrence[],
): ReadonlyMap<number, SymbolDeclarationLink> {
  const links = new Map<number, SymbolDeclarationLink>();
  for (const occurrence of occurrences) {
    if (!links.has(occurrence.line)) {
      links.set(occurrence.line, {
        href: occurrence.href,
        name: occurrence.name,
      });
    }
  }
  return links;
}
