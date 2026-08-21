import { Marked, render, Renderer } from "@deno/gfm";
import type { SymbolAnalysis, SymbolDeclarationLink } from "./types.ts";

type HeadingToken = Marked.Tokens.Heading;
type SourceHeading = {
  line: number;
  start: number;
  end: number;
  slugIndex: number;
  token: HeadingToken;
};
type NestedToken = Marked.Token & {
  items?: Array<{ tokens?: Marked.Token[] }>;
  tokens?: Marked.Token[];
};

/** Finds source headings and uses rendered GFM output as the slug authority. */
export function markdownHeadings(text: string): SymbolAnalysis {
  const tokens = Marked.lexer(text);
  const headings = headingTokens(tokens);
  if (headings.length === 0) return emptyAnalysis();

  const renderer = new HeadingRenderer();
  render(text, { disableHtmlSanitization: true, renderer });
  const ids = renderer.ids;
  const sources = sourceHeadings(text, headings, excludedLines(text, tokens));
  const declarations = new Set<number>();
  const declarationLinks = new Map<number, SymbolDeclarationLink>();
  const occurrences = sources.flatMap((heading) => {
    const id = ids[heading.slugIndex];
    if (id === undefined) return [];
    const href = `#${id}`;
    const name = heading.token.text.replace(/\s+/g, " ").trim() || id ||
      "heading";
    declarations.add(heading.line);
    declarationLinks.set(heading.line, {
      href,
      id: heading.start === heading.end && id ? id : undefined,
      kind: "heading",
      name,
    });
    if (heading.start === heading.end) return [];
    return [{
      name,
      start: heading.start,
      end: heading.end,
      line: heading.line,
      href,
      id: id || undefined,
      kind: "heading" as const,
      declaration: true,
    }];
  });
  return {
    occurrences,
    declarationLines: declarations,
    declarationCommentLines: new Map(),
    declarationLinks,
  };
}

class HeadingRenderer extends Renderer {
  readonly ids: string[] = [];

  override heading(token: HeadingToken): string {
    const heading = super.heading(token);
    this.ids.push(heading.match(/^<h[1-6] id="([^"]*)">/)?.[1] ?? "");
    return "";
  }
}

function emptyAnalysis(): SymbolAnalysis {
  return {
    occurrences: [],
    declarationLines: new Set(),
    declarationCommentLines: new Map(),
    declarationLinks: new Map(),
  };
}

function headingTokens(tokens: readonly Marked.Token[]): HeadingToken[] {
  const headings: HeadingToken[] = [];
  for (const token of tokens as readonly NestedToken[]) {
    if (token.type === "heading") {
      headings.push(token as HeadingToken);
      continue;
    }
    if (token.items) {
      for (const item of token.items) {
        if (item.tokens) headings.push(...headingTokens(item.tokens));
      }
    } else if (token.tokens) {
      headings.push(...headingTokens(token.tokens));
    }
  }
  return headings;
}

function sourceHeadings(
  text: string,
  tokens: readonly HeadingToken[],
  excluded: ReadonlySet<number>,
): SourceHeading[] {
  const lines = text.split("\n");
  const offsets = lineOffsets(lines);
  const headings: SourceHeading[] = [];
  let searchLine = 0;
  for (const [slugIndex, token] of tokens.entries()) {
    const rawLines = token.raw.split("\n");
    while (rawLines.at(-1)?.trim() === "") rawLines.pop();
    const expected = rawLines.map((line) => normalizedContent(line).text);
    const line = matchingLine(lines, expected, searchLine, excluded);
    if (line === undefined) continue;
    const content = normalizedContent(lines[line]);
    const firstText = token.text.split("\n")[0];
    const atx = content.text.match(/^ {0,3}#{1,6}(?:[ \t]+|$)/);
    const contentStart = atx?.[0].length ?? 0;
    const textStart = content.text.indexOf(firstText, contentStart);
    const relativeStart = textStart < 0 ? contentStart : textStart;
    headings.push({
      line: line + 1,
      start: offsets[line] + content.offset + relativeStart,
      end: offsets[line] + content.offset + relativeStart + firstText.length,
      slugIndex,
      token,
    });
    searchLine = line + rawLines.length;
  }
  return headings;
}

function matchingLine(
  lines: readonly string[],
  expected: readonly string[],
  searchLine: number,
  excluded: ReadonlySet<number>,
): number | undefined {
  for (let line = searchLine; line + expected.length <= lines.length; line++) {
    if (
      expected.every((value, index) =>
        !excluded.has(line + index) &&
        normalizedContent(lines[line + index]).text === value
      )
    ) return line;
  }
}

function excludedLines(
  text: string,
  tokens: readonly Marked.Token[],
): ReadonlySet<number> {
  const lines = text.split("\n");
  const offsets = lineOffsets(lines);
  const excluded = fencedLines(lines);
  let cursor = 0;
  for (const token of tokens) {
    if (token.type === "footnotes") continue;
    const start = text.indexOf(token.raw, cursor);
    if (start < 0) continue;
    if (token.type === "code" || token.type === "html") {
      const first = lineAtOffset(offsets, start);
      const last = lineAtOffset(offsets, start + token.raw.length - 1);
      for (let line = first; line <= last; line++) excluded.add(line);
    }
    cursor = start + token.raw.length;
  }
  return excluded;
}

function fencedLines(lines: readonly string[]): Set<number> {
  const excluded = new Set<number>();
  let fence: string | undefined;
  for (let index = 0; index < lines.length; index++) {
    const content = normalizedContent(lines[index]).text;
    const opening = content.match(/^(`{3,}|~{3,})/);
    if (!fence && opening) {
      fence = opening[1];
      excluded.add(index);
      continue;
    }
    if (!fence) continue;
    excluded.add(index);
    const closing = content.match(/^(`{3,}|~{3,})[ \t]*$/)?.[1];
    if (closing?.[0] === fence[0] && closing.length >= fence.length) {
      fence = undefined;
    }
  }
  return excluded;
}

function normalizedContent(line: string): { text: string; offset: number } {
  let text = line;
  let offset = 0;
  while (true) {
    const container = text.match(
      /^( {0,3}>[ \t]?| {0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+)/,
    );
    if (!container) break;
    offset += container[0].length;
    text = text.slice(container[0].length);
  }
  const indentation = text.match(/^ {1,3}(?=\S)/)?.[0].length ?? 0;
  return {
    text: text.slice(indentation).trimEnd(),
    offset: offset + indentation,
  };
}

function lineOffsets(lines: readonly string[]): number[] {
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }
  return offsets;
}

function lineAtOffset(offsets: readonly number[], offset: number): number {
  let low = 0;
  let high = offsets.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= offset) low = middle;
    else high = middle;
  }
  return low;
}
