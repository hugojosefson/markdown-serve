import {
  editPreviewIndicatorClient,
  installPreviewIndicator,
} from "./edit-preview-indicator.ts";

type EditorEvent = {
  detail?: { base?: unknown; tag?: unknown };
  preventDefault?(): void;
  returnValue?: string;
  target?: EditorElement;
};

type EditorElement = {
  classList: { add(name: string): void; remove(name: string): void };
  dataset: Record<string, string | undefined>;
  disabled: boolean;
  hidden: boolean;
  innerHTML: string;
  scrollLeft: number;
  scrollTop: number;
  scrollHeight: number;
  selectionEnd: number;
  selectionStart: number;
  clientHeight: number;
  style: { transform: string };
  setAttribute(name: string, value: string): void;
  textContent: string | null;
  value: string;
  addEventListener(type: string, listener: (event: EditorEvent) => void): void;
  closest<T>(selector: string): T | null;
};

type EditorDocument = {
  querySelector<T>(selector: string): T | null;
  addEventListener(type: string, listener: (event: EditorEvent) => void): void;
  dispatchEvent(event: Event): boolean;
  createRange?(): {
    setEnd(node: unknown, offset: number): void;
    setStart(node: unknown, offset: number): void;
  };
  createTreeWalker?(
    root: unknown,
    whatToShow: number,
  ): { nextNode(): { nodeValue: string | null } | null };
};

type EditorLifecycle = {
  addEventListener(type: string, listener: (event: EditorEvent) => void): void;
};

type DraftHunk = { start: number; count: number; text: string };
type DraftPayload = {
  draft: string;
  git: boolean;
  html: string;
  hunks: DraftHunk[];
  limited: boolean;
  preview?: string;
};
type EditFetch = (
  url: string,
  options: {
    method: string;
    signal: AbortSignal;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/** Adds live highlighting and in-memory Git hunk actions to the native form. */
export function installEdit(
  document: EditorDocument,
  fetcher: EditFetch = fetch as unknown as EditFetch,
  lifecycle: EditorLifecycle = globalThis as unknown as EditorLifecycle,
  indicatorInstaller: typeof installPreviewIndicator = installPreviewIndicator,
): void {
  const select = <T extends EditorElement>(selector: string) =>
    document.querySelector<T>(selector);
  const form = select(".edit-page");
  const tag = select('.edit-page input[name="etag"]');
  const text = select(".edit-text");
  const surface = select(".edit-surface");
  const pre = select(".edit-highlight");
  const code = select(".edit-highlight code");
  const gutter = select(".edit-gutter");
  const details = select(".edit-hunk-details");
  const diff = select(".edit-hunk-details pre");
  const close = select(".edit-hunk-close");
  const revert = select(".edit-hunk-revert");
  const status = select(".edit-status");
  const preview = select(".edit-markdown-preview");
  const workspace = select(".edit-workspace");
  if (
    !form?.dataset.editPath || !tag || !text || !surface || !pre || !code ||
    !gutter || !details || !diff || !close || !revert || !status
  ) {
    return;
  }
  const path = form.dataset.editPath;
  let controller: AbortController | undefined;
  let generation = 0;
  let hunks: DraftHunk[] = [];
  let selected: number | undefined;
  let timer: number | undefined;
  let mergeTimer: number | undefined;
  let mergeController: AbortController | undefined;
  let mergeGeneration = 0;
  let mergeNeeded = false;
  let mergeConflicted = false;
  let submitting = false;
  let baseText = text.value;
  const updatePreviewIndicator = indicatorInstaller(
    document,
    text,
    preview,
    workspace,
  );

  const hideDiff = (): void => {
    selected = undefined;
    details.hidden = true;
  };
  const syncScroll = (): void => {
    pre.scrollTop = text.scrollTop;
    pre.scrollLeft = text.scrollLeft;
    gutter.style.transform = `translateY(${-text.scrollTop}px)`;
  };
  let expectedEditorScroll: number | undefined;
  let expectedPreviewScroll: number | undefined;
  const scrollRange = (element: EditorElement): number =>
    Math.max(0, element.scrollHeight - element.clientHeight);
  const syncPreviewScroll = (): void => {
    if (!preview) {
      return;
    }
    const sourceRange = scrollRange(text);
    const previewRange = scrollRange(preview);
    if (!sourceRange || !previewRange) {
      return;
    }
    const target = text.scrollTop / sourceRange * previewRange;
    if (Math.abs(preview.scrollTop - target) < 0.5) {
      return;
    }
    expectedPreviewScroll = target;
    preview.scrollTop = target;
  };
  const syncEditorScroll = (): void => {
    if (!preview) {
      return;
    }
    const sourceRange = scrollRange(text);
    const previewRange = scrollRange(preview);
    if (!sourceRange || !previewRange) {
      return;
    }
    const target = preview.scrollTop / previewRange * sourceRange;
    if (Math.abs(text.scrollTop - target) < 0.5) {
      return;
    }
    expectedEditorScroll = target;
    text.scrollTop = target;
    syncScroll();
  };
  const renderGutter = (next: DraftHunk[]): void => {
    hunks = next.filter((hunk) =>
      Number.isSafeInteger(hunk.start) && hunk.start > 0 &&
      Number.isSafeInteger(hunk.count) && hunk.count > 0 &&
      typeof hunk.text === "string"
    );
    gutter.innerHTML = hunks.map((hunk, index) =>
      `<button class="edit-hunk" type="button" data-edit-hunk="${index}" style="--edit-line:${hunk.start};--edit-lines:${hunk.count}" aria-label="Inspect Git change ${
        index + 1
      } at line ${hunk.start}" title="Inspect Git change"></button>`
    ).join("");
  };
  const apply = (payload: DraftPayload): void => {
    if (
      typeof payload.html !== "string" || typeof payload.draft !== "string" ||
      !Array.isArray(payload.hunks)
    ) {
      return;
    }
    const draftChanged = text.value !== payload.draft;
    if (draftChanged) {
      text.value = payload.draft;
    }
    code.innerHTML = payload.html;
    if (preview && typeof payload.preview === "string") {
      preview.innerHTML = payload.preview;
    }
    renderGutter(payload.hunks);
    hideDiff();
    surface.classList.add("is-enhanced");
    syncScroll();
    syncPreviewScroll();
    updatePreviewIndicator();
    if (draftChanged) {
      document.dispatchEvent(new Event("markdown-serve:editor-draft"));
    }
    if (mergeConflicted) {
      status.textContent =
        "Disk changes overlap your draft. Resolve the merge markers before saving.";
    } else if (payload.limited) {
      status.textContent = "Editing; Git diff is too large to display";
    }
  };
  const update = async (revertHunk?: number): Promise<void> => {
    const mine = ++generation;
    const snapshot = text.value;
    controller?.abort();
    const requestController = controller = new AbortController();
    try {
      const response = await fetcher(
        `/__markdown_serve__/highlight?path=${encodeURIComponent(path)}${
          revertHunk === undefined ? "" : `&revert=${revertHunk}`
        }`,
        {
          method: "POST",
          signal: requestController.signal,
          headers: { "Content-Type": "text/plain; charset=UTF-8" },
          body: snapshot,
        },
      );
      if (
        !response.ok || mine !== generation || requestController.signal.aborted
      ) {
        return;
      }
      const value = await response.json();
      if (
        mine !== generation || requestController.signal.aborted ||
        text.value !== snapshot
      ) {
        return;
      }
      if (!value || typeof value !== "object") {
        return;
      }
      apply(value as DraftPayload);
    } catch { /* The server-rendered/native editor remains usable. */ }
  };
  const schedule = (): void => {
    mergeConflicted = hasConflictMarkers(text.value);
    status.textContent = mergeConflicted
      ? "Resolve the disk merge markers before saving"
      : "Editing";
    code.textContent = text.value;
    renderGutter([]);
    hideDiff();
    updatePreviewIndicator();
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => update(), 120) as unknown as number;
    if (mergeNeeded) {
      scheduleDiskMerge();
    }
  };
  const mergeFromDisk = async (): Promise<void> => {
    const mine = ++mergeGeneration;
    const snapshot = text.value;
    const baseSnapshot = baseText;
    const tagSnapshot = tag.value;
    mergeController?.abort();
    const requestController = mergeController = new AbortController();
    try {
      const response = await fetcher(
        `/__markdown_serve__/merge?path=${encodeURIComponent(path)}`,
        {
          method: "POST",
          signal: requestController.signal,
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: JSON.stringify({
            base: baseSnapshot,
            draft: snapshot,
            tag: tagSnapshot,
          }),
        },
      );
      if (
        mine !== mergeGeneration || requestController.signal.aborted
      ) {
        return;
      }
      if (!response.ok) {
        throw new Error("disk merge failed");
      }
      const value = await response.json();
      if (!value || typeof value !== "object") {
        throw new Error("invalid merge response");
      }
      const payload = value as {
        base?: unknown;
        changed?: unknown;
        conflicted?: unknown;
        draft?: unknown;
        limited?: unknown;
        tag?: unknown;
      };
      if (payload.changed === false) {
        mergeNeeded = false;
        return;
      }
      if (payload.changed !== true) {
        throw new Error("invalid merge response");
      }
      if (
        mine !== mergeGeneration || requestController.signal.aborted ||
        text.value !== snapshot || baseText !== baseSnapshot ||
        tag.value !== tagSnapshot
      ) {
        scheduleDiskMerge();
        return;
      }
      if (payload.limited === true) {
        mergeNeeded = false;
        status.textContent =
          "File changed on disk; automatic merge is too large. Save will check for conflicts.";
        return;
      }
      if (
        typeof payload.base !== "string" ||
        typeof payload.draft !== "string" ||
        typeof payload.tag !== "string" ||
        typeof payload.conflicted !== "boolean"
      ) {
        throw new Error("invalid merge response");
      }
      generation++;
      controller?.abort();
      text.value = payload.draft;
      baseText = payload.base;
      tag.value = payload.tag;
      document.dispatchEvent(
        new CustomEvent("markdown-serve:editor-base", {
          detail: { base: baseText, tag: tag.value },
        }),
      );
      mergeNeeded = false;
      mergeConflicted = payload.conflicted;
      code.textContent = text.value;
      renderGutter([]);
      hideDiff();
      status.textContent = mergeConflicted
        ? "Disk changes overlap your draft. Resolve the merge markers before saving."
        : snapshot === baseSnapshot
        ? "Loaded changes from disk"
        : "Merged changes from disk into your draft";
      void update();
    } catch {
      if (mine === mergeGeneration && !requestController.signal.aborted) {
        mergeNeeded = false;
        status.textContent =
          "Could not load changes from disk; your draft is preserved";
      }
    }
  };
  const scheduleDiskMerge = (): void => {
    if (mergeTimer !== undefined) {
      clearTimeout(mergeTimer);
    }
    mergeTimer = setTimeout(() => mergeFromDisk(), 160) as unknown as number;
  };
  const hasConflictMarkers = (value: string): boolean =>
    value.includes("<<<<<<< draft\n") ||
    value.includes("||||||| previous disk version\n") ||
    value.includes(">>>>>>> current disk version");

  text.addEventListener("input", schedule);
  text.addEventListener("scroll", () => {
    syncScroll();
    if (
      expectedEditorScroll !== undefined &&
      Math.abs(text.scrollTop - expectedEditorScroll) < 0.5
    ) {
      expectedEditorScroll = undefined;
      return;
    }
    expectedEditorScroll = undefined;
    syncPreviewScroll();
  });
  preview?.addEventListener("scroll", () => {
    if (
      expectedPreviewScroll !== undefined &&
      Math.abs(preview.scrollTop - expectedPreviewScroll) < 0.5
    ) {
      expectedPreviewScroll = undefined;
      return;
    }
    expectedPreviewScroll = undefined;
    syncEditorScroll();
  });
  if (workspace) {
    form.classList.add("is-enhanced");
  }
  gutter.addEventListener("click", (event) => {
    const button = event.target?.closest<EditorElement>("[data-edit-hunk]");
    const index = Number(button?.dataset.editHunk);
    if (!Number.isSafeInteger(index) || !hunks[index]) {
      return;
    }
    selected = index;
    diff.textContent = hunks[index].text;
    details.hidden = false;
  });
  close.addEventListener("click", hideDiff);
  revert.addEventListener("click", () => {
    if (selected === undefined) {
      return;
    }
    revert.disabled = true;
    void update(selected).finally(() => revert.disabled = false);
  });
  form.addEventListener("submit", (event) => {
    if ((event as { defaultPrevented?: boolean }).defaultPrevented) {
      return;
    }
    mergeConflicted = hasConflictMarkers(text.value);
    if (mergeConflicted) {
      event.preventDefault?.();
      status.textContent = "Resolve the disk merge markers before saving";
      return;
    }
    submitting = true;
  });
  lifecycle.addEventListener("beforeunload", (event) => {
    if (submitting || text.value === baseText) {
      return;
    }
    event.preventDefault?.();
    event.returnValue = "";
  });
  document.addEventListener("markdown-serve:reload", () => {
    mergeGeneration++;
    mergeController?.abort();
    mergeNeeded = true;
    status.textContent = "Loading changes from disk…";
    scheduleDiskMerge();
  });
  document.addEventListener("markdown-serve:editor-layout", () => {
    syncPreviewScroll();
    updatePreviewIndicator();
  });
  document.addEventListener("markdown-serve:editor-state", (event) => {
    if (
      typeof event.detail?.base === "string" &&
      typeof event.detail.tag === "string"
    ) {
      baseText = event.detail.base;
      tag.value = event.detail.tag;
    }
    code.textContent = text.value;
    void update();
  });
  syncScroll();
  void update();
}

export const editClient =
  `const installPreviewIndicator=${editPreviewIndicatorClient};(${installEdit.toString()})(document,undefined,undefined,installPreviewIndicator);`;
