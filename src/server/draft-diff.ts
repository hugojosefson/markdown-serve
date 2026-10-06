import { applyPatch, reversePatch, structuredPatch } from "diff";

export type DraftHunk = {
  start: number;
  count: number;
  text: string;
};

export type DraftDiff = {
  draft: string;
  hunks: DraftHunk[];
  limited: boolean;
};

const maxCombinedLength = 2 * 1024 * 1024;
const diffOptions = {
  context: 3,
  maxEditLength: 20_000,
  timeout: 100,
};

/** Computes bounded line hunks relative to a HEAD blob. */
export function draftDiff(
  head: string,
  draft: string,
  revert?: number,
): DraftDiff | undefined {
  if (head.length + draft.length > maxCombinedLength) {
    return { draft, hunks: [], limited: true };
  }
  const patch = structuredPatch(
    "HEAD",
    "draft",
    head,
    draft,
    undefined,
    undefined,
    diffOptions,
  );
  if (!patch) {
    return { draft, hunks: [], limited: true };
  }
  if (revert !== undefined) {
    const hunk = patch.hunks[revert];
    if (!hunk) {
      return undefined;
    }
    const reversed = reversePatch({ ...patch, hunks: [hunk] });
    const reverted = applyPatch(draft, reversed, { fuzzFactor: 0 });
    if (reverted === false) {
      return undefined;
    }
    return draftDiff(head, reverted);
  }
  return {
    draft,
    limited: false,
    hunks: patch.hunks.map((hunk) => {
      const marker = changedRange(hunk.newStart, hunk.lines);
      return {
        ...marker,
        text: `@@ -${range(hunk.oldStart, hunk.oldLines)} +${
          range(hunk.newStart, hunk.newLines)
        } @@\n${hunk.lines.join("\n")}`,
      };
    }),
  };
}

function changedRange(
  newStart: number,
  lines: string[],
): { start: number; count: number } {
  let cursor = Math.max(1, newStart);
  let first = Number.MAX_SAFE_INTEGER;
  let last = cursor;
  for (const line of lines) {
    const marker = line[0];
    if (marker === "+" || marker === "-") {
      first = Math.min(first, cursor);
      last = Math.max(last, cursor + 1);
    }
    if (marker !== "-") {
      cursor++;
    }
  }
  const start = first === Number.MAX_SAFE_INTEGER
    ? Math.max(1, newStart)
    : first;
  return { start, count: Math.max(1, last - start) };
}

function range(start: number, lines: number): string {
  return lines === 1 ? String(start) : `${start},${lines}`;
}
