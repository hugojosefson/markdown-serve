import { mergeDiff3 } from "node-diff3";

export type DraftMerge = {
  draft: string;
  conflicted: boolean;
  limited: boolean;
};

const maxCombinedMergeLines = 6_000;

/** Three-way line merge of the user's draft and a newer disk version. */
export function mergeDraft(
  base: string,
  draft: string,
  disk: string,
): DraftMerge {
  const normalizedBase = normalizeEditorText(base);
  const normalizedDraft = normalizeEditorText(draft);
  const normalizedDisk = normalizeEditorText(disk);
  if (normalizedDraft === normalizedBase) {
    return { draft: normalizedDisk, conflicted: false, limited: false };
  }
  if (normalizedDisk === normalizedBase || normalizedDraft === normalizedDisk) {
    return { draft: normalizedDraft, conflicted: false, limited: false };
  }
  const baseLines = normalizedBase.split("\n");
  const draftLines = normalizedDraft.split("\n");
  const diskLines = normalizedDisk.split("\n");
  if (
    baseLines.length + draftLines.length + diskLines.length >
      maxCombinedMergeLines
  ) {
    return { draft: normalizedDraft, conflicted: false, limited: true };
  }
  const merged = mergeDiff3(draftLines, baseLines, diskLines, {
    excludeFalseConflicts: true,
    label: {
      a: "draft",
      o: "previous disk version",
      b: "current disk version",
    },
  });
  return {
    draft: merged.result.join("\n"),
    conflicted: merged.conflict,
    limited: false,
  };
}

export function normalizeEditorText(text: string): string {
  return text.replace(/\r\n|\r/g, "\n");
}
