type PreviewElement = {
  dataset: Record<string, string | undefined>;
  selectionEnd: number;
  selectionStart: number;
  textContent: string | null;
  value: string;
  addEventListener(type: string, listener: () => void): void;
};

type PreviewDocument = {
  createRange?(): {
    setEnd(node: unknown, offset: number): void;
    setStart(node: unknown, offset: number): void;
  };
  createTreeWalker?(
    root: unknown,
    whatToShow: number,
  ): { nextNode(): { nodeValue: string | null } | null };
};

/** Tracks a textarea caret or selection in a rendered Markdown preview. */
export function installPreviewIndicator(
  document: PreviewDocument,
  text: PreviewElement,
  preview: PreviewElement | null,
  workspace: PreviewElement | null,
): () => void {
  type WordRange = { end: number; start: number; value: string };
  type HighlightRegistry = {
    delete(name: string): void;
    set(name: string, highlight: unknown): void;
  };
  const names = ["edit-preview-caret", "edit-preview-selection"];
  const registry = (globalThis as unknown as {
    CSS?: { highlights?: HighlightRegistry };
  }).CSS?.highlights;
  const HighlightConstructor = (globalThis as unknown as {
    Highlight?: new (...ranges: unknown[]) => unknown;
  }).Highlight;
  const words = (value: string): WordRange[] =>
    [...value.matchAll(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)].map(
      (match) => ({
        end: (match.index ?? 0) + match[0].length,
        start: match.index ?? 0,
        value: match[0].toLocaleLowerCase(),
      }),
    );
  const visibleMarkdown = (value: string): string =>
    value
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/<https?:\/\/[^>]+>/g, " ")
      .replace(/[`*_~#>|]/g, " ");
  const selectedWords = (): WordRange[] => {
    const start = Math.min(text.selectionStart, text.selectionEnd);
    const end = Math.max(text.selectionStart, text.selectionEnd);
    if (start !== end) {
      return words(
        visibleMarkdown(text.value.slice(start, Math.min(end, start + 4_096))),
      ).slice(0, 64);
    }
    const localStart = Math.max(0, start - 256);
    const sourceWords = words(
      text.value.slice(localStart, Math.min(text.value.length, start + 256)),
    );
    const localPosition = start - localStart;
    const containing = sourceWords.find((word) =>
      word.start <= localPosition && word.end >= localPosition
    );
    const nearest = containing ?? sourceWords.reduce<WordRange | undefined>(
      (best, word) => {
        if (!best) {
          return word;
        }
        const distance = Math.min(
          Math.abs(localPosition - word.start),
          Math.abs(localPosition - word.end),
        );
        const bestDistance = Math.min(
          Math.abs(localPosition - best.start),
          Math.abs(localPosition - best.end),
        );
        return distance < bestDistance ? word : best;
      },
      undefined,
    );
    return nearest ? [nearest] : [];
  };
  const closestSequence = (
    sourceWords: WordRange[],
    previewWords: WordRange[],
    sourceRatio: number,
  ): WordRange[] => {
    const expected = Math.round(
      sourceRatio * Math.max(0, previewWords.length - 1),
    );
    const previewStart = Math.max(0, expected - 512);
    const previewEnd = Math.min(previewWords.length, expected + 513);
    let bestStart = -1;
    let bestLength = 0;
    let bestDistance = Infinity;
    for (let sourceStart = 0; sourceStart < sourceWords.length; sourceStart++) {
      for (
        let candidateStart = previewStart;
        candidateStart < previewEnd;
        candidateStart++
      ) {
        let length = 0;
        while (
          sourceStart + length < sourceWords.length &&
          candidateStart + length < previewEnd &&
          sourceWords[sourceStart + length].value ===
            previewWords[candidateStart + length].value
        ) {
          length++;
        }
        const distance = Math.abs(candidateStart - expected);
        if (
          length > bestLength ||
          (length === bestLength && length > 0 && distance < bestDistance)
        ) {
          bestStart = candidateStart;
          bestLength = length;
          bestDistance = distance;
        }
      }
    }
    return bestStart < 0
      ? []
      : previewWords.slice(bestStart, bestStart + bestLength);
  };
  const domRange = (start: number, end: number): unknown | undefined => {
    if (!preview || !document.createTreeWalker || !document.createRange) {
      return undefined;
    }
    const walker = document.createTreeWalker(preview, 4);
    const range = document.createRange();
    let offset = 0;
    let started = false;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const length = node.nodeValue?.length ?? 0;
      if (!started && start <= offset + length) {
        range.setStart(node, Math.max(0, start - offset));
        started = true;
      }
      if (started && end <= offset + length) {
        range.setEnd(node, Math.max(0, end - offset));
        return range;
      }
      offset += length;
    }
    return undefined;
  };
  const update = (): void => {
    names.forEach((name) => registry?.delete(name));
    if (
      !preview || !workspace?.dataset.editLayout?.startsWith("split-") ||
      !registry || !HighlightConstructor
    ) {
      return;
    }
    const sourceWords = selectedWords();
    const previewText = preview.textContent ?? "";
    const sourcePosition = Math.min(text.selectionStart, text.selectionEnd);
    const target = closestSequence(
      sourceWords,
      words(previewText),
      sourcePosition / Math.max(1, text.value.length),
    );
    if (!target.length) {
      return;
    }
    const range = domRange(target[0].start, target.at(-1)!.end);
    if (!range) {
      return;
    }
    const name = text.selectionStart === text.selectionEnd
      ? "edit-preview-caret"
      : "edit-preview-selection";
    registry.set(name, new HighlightConstructor(range));
  };
  if (preview && workspace) {
    text.addEventListener("click", update);
    text.addEventListener("keyup", update);
    text.addEventListener("select", update);
  }
  return update;
}

export const editPreviewIndicatorClient = installPreviewIndicator.toString();
