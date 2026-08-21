const slashLanguages = new Set([
  "c",
  "cpp",
  "csharp",
  "go",
  "java",
  "javascript",
  "jsx",
  "rust",
  "typescript",
  "tsx",
]);

const hashLanguages = new Set(["bash", "python"]);

/** Returns the first line of a comment immediately attached to a declaration. */
export function attachedCommentLine(
  text: string,
  language: string,
  declarationLine: number,
): number | undefined {
  const lines = text.split("\n");
  const previous = declarationLine - 2;
  if (previous < 0 || lines[previous].trim() === "") return;

  const immediate = precedingComment(lines, previous, language);
  if (!immediate) return;
  if (immediate.documentation) return immediate.start + 1;

  let nearestBlock = immediate.kind === "block" ? immediate : undefined;
  let cursor = immediate.start - 1;
  while (cursor >= 0 && lines[cursor].trim() !== "") {
    const earlier = precedingComment(lines, cursor, language);
    if (!earlier) break;
    if (earlier.documentation) return earlier.start + 1;
    if (!nearestBlock && earlier.kind === "block") nearestBlock = earlier;
    cursor = earlier.start - 1;
  }
  return (nearestBlock ?? immediate).start + 1;
}

type CommentBlock = {
  start: number;
  documentation: boolean;
  kind: "block" | "single";
};

function precedingComment(
  lines: readonly string[],
  end: number,
  language: string,
): CommentBlock | undefined {
  return slashLanguages.has(language)
    ? precedingBlock(lines, end, language) ??
      precedingSingleLines(lines, end, language)
    : precedingSingleLines(lines, end, language);
}

function precedingBlock(
  lines: readonly string[],
  end: number,
  language: string,
): CommentBlock | undefined {
  if (!lines[end].trimEnd().endsWith("*/")) return;
  for (let start = end; start >= 0; start--) {
    const opening = lines[start].trimStart();
    if (!opening.startsWith("/*")) continue;
    return {
      start,
      documentation: isDocumentationBlock(opening, language),
      kind: "block",
    };
  }
}

function precedingSingleLines(
  lines: readonly string[],
  end: number,
  language: string,
): CommentBlock | undefined {
  const prefix = slashLanguages.has(language)
    ? "//"
    : hashLanguages.has(language)
    ? "#"
    : undefined;
  if (!prefix || !isSingleComment(lines[end], end, prefix)) return;
  let start = end;
  while (
    start > 0 && isSingleComment(lines[start - 1], start - 1, prefix)
  ) start--;
  let documentationEnd = end;
  while (
    documentationEnd >= start &&
    !isDocumentationLine(lines[documentationEnd].trimStart(), language)
  ) documentationEnd--;
  if (documentationEnd < start) {
    return { start, documentation: false, kind: "single" };
  }
  let documentationStart = documentationEnd;
  while (
    documentationStart > start &&
    isDocumentationLine(lines[documentationStart - 1].trimStart(), language)
  ) {
    documentationStart--;
  }
  return {
    start: documentationStart,
    documentation: true,
    kind: "single",
  };
}

function isDocumentationBlock(opening: string, language: string): boolean {
  if (["c", "cpp", "rust"].includes(language)) {
    return opening.startsWith("/**") || opening.startsWith("/*!");
  }
  return [
    "csharp",
    "java",
    "javascript",
    "jsx",
    "typescript",
    "tsx",
  ].includes(language) && opening.startsWith("/**");
}

function isDocumentationLine(line: string, language: string): boolean {
  if (["c", "cpp", "rust"].includes(language)) {
    return line.startsWith("///") || line.startsWith("//!");
  }
  return language === "csharp" && line.startsWith("///");
}

function isSingleComment(line: string, index: number, prefix: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith(prefix) &&
    !(prefix === "#" && index === 0 && trimmed.startsWith("#!"));
}
