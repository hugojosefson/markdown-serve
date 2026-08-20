export type SourceLineAnnotation = {
  staged?: boolean;
  unstaged?: boolean;
  deletions?: number;
};

type DiffLineChange = { deletions?: number };

/** Parses zero-context unified-diff hunk headers into new-file line changes. */
export function parseUnifiedDiff(
  diff: string,
  lineLimit = Number.MAX_SAFE_INTEGER,
): ReadonlyMap<number, DiffLineChange> {
  const changes = new Map<number, DiffLineChange>();
  for (const line of diff.split("\n")) {
    const hunk = parseHunk(line);
    if (!hunk) {
      continue;
    }
    for (
      let line = hunk.newStart;
      line < Math.min(hunk.newStart + hunk.newCount, lineLimit + 1);
      line++
    ) {
      if (line > 0) {
        changes.set(line, changes.get(line) ?? {});
      }
    }
    const deletions = hunk.oldCount;
    if (deletions > 0 && lineLimit > 0) {
      const line = Math.min(Math.max(1, hunk.newStart), lineLimit);
      const change = changes.get(line) ?? {};
      change.deletions = (change.deletions ?? 0) + deletions;
      changes.set(line, change);
    }
  }
  return changes;
}

export function mergeDiffAnnotations(
  staged: string | undefined,
  unstaged: string | undefined,
  lineCount: number,
): ReadonlyMap<number, SourceLineAnnotation> {
  const annotations = new Map<number, SourceLineAnnotation>();
  addAnnotations(
    annotations,
    parseUnifiedDiff(staged ?? "", lineCount),
    "staged",
    lineCount,
  );
  addAnnotations(
    annotations,
    parseUnifiedDiff(unstaged ?? "", lineCount),
    "unstaged",
    lineCount,
  );
  return annotations;
}

export function untrackedAnnotations(
  lineCount: number,
): ReadonlyMap<number, SourceLineAnnotation> {
  return new Map(
    Array.from(
      { length: lineCount },
      (_, index) => [index + 1, { unstaged: true }],
    ),
  );
}

function addAnnotations(
  annotations: Map<number, SourceLineAnnotation>,
  changes: ReadonlyMap<number, DiffLineChange>,
  side: "staged" | "unstaged",
  lineCount: number,
): void {
  for (const [line, change] of changes) {
    if (line < 1 || line > lineCount) {
      continue;
    }
    const annotation = annotations.get(line) ?? {};
    annotation[side] = true;
    if (change.deletions) {
      annotation.deletions = (annotation.deletions ?? 0) + change.deletions;
    }
    annotations.set(line, annotation);
  }
}

function parseHunk(
  line: string,
): { oldCount: number; newCount: number; newStart: number } | undefined {
  const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) {
    return undefined;
  }
  const oldCount = Number(match[2] ?? 1);
  const newStart = Number(match[3]);
  const newCount = Number(match[4] ?? 1);
  if (
    !Number.isSafeInteger(oldCount) || !Number.isSafeInteger(newStart) ||
    !Number.isSafeInteger(newCount)
  ) {
    return undefined;
  }
  return { oldCount, newCount, newStart };
}
