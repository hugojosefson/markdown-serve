import { Parser } from "web-tree-sitter";
import { declarationTypes, symbolGrammar } from "./declaration-rules.ts";
import { attachedCommentLine } from "./comment-attachment.ts";
import { loadLanguage } from "./engine.ts";
import {
  syntaxDeclarations,
  syntaxIdentifiers,
} from "./syntax-declarations.ts";
import { markdownHeadings } from "./markdown-headings.ts";
import type {
  SymbolAnalysis,
  SymbolDeclarationLink,
  SymbolOccurrence,
  SymbolTargets,
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
  targets: SymbolTargets = new Map(),
): Promise<SymbolAnalysis | undefined> {
  if (language === "markdown") {
    if (new TextEncoder().encode(text).byteLength > maxBytes) return;
    try {
      return markdownHeadings(text);
    } catch {
      return;
    }
  }
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
      return analysis(
        syntaxDeclarations(tree.rootNode, types),
        syntaxIdentifiers(tree.rootNode),
        text,
        language,
        targets,
      );
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
  identifiers: ReturnType<typeof syntaxIdentifiers>,
  text: string,
  language: string,
  indexedTargets: SymbolTargets,
): SymbolAnalysis {
  const counts = new Map<string, number>();
  for (const item of found) {
    counts.set(item.name, (counts.get(item.name) ?? 0) + 1);
  }
  const localTargets = new Map(
    [...counts].flatMap(([name, count]) =>
      count === 1
        ? [[name, `#symbol-${encodeURIComponent(name)}`] as const]
        : []
    ),
  );
  const declarations = found.map((item): SymbolOccurrence => {
    const commentLine = attachedCommentLine(
      text,
      language,
      item.declarationLine,
    );
    const { declarationLine: _, ...occurrence } = item;
    return {
      ...occurrence,
      declaration: true,
      commentLines: commentLine ? item.line - commentLine : undefined,
      href: localTargets.get(item.name) ?? `#L${item.line}`,
      id: localTargets.has(item.name) ? `symbol-${item.name}` : undefined,
    };
  });
  const declarationOffsets = new Set(found.map((item) => item.start));
  const referenceOffsets = new Set<number>();
  const references = identifiers.flatMap((item): SymbolOccurrence[] => {
    const href = localTargets.get(item.name) ?? indexedTargets.get(item.name);
    if (
      !href || declarationOffsets.has(item.start) ||
      referenceOffsets.has(item.start)
    ) {
      return [];
    }
    referenceOffsets.add(item.start);
    return [{ ...item, declaration: false, href }];
  });
  const occurrences = [...declarations, ...references].toSorted((left, right) =>
    left.start - right.start
  );
  return {
    occurrences,
    declarationLines: new Set(found.map((item) => item.line)),
    declarationCommentLines: new Map(
      occurrences.flatMap((item) =>
        item.commentLines ? [[item.line, item.commentLines] as const] : []
      ),
    ),
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
