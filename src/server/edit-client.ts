type EditorEvent = {
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
  style: { transform: string };
  textContent: string | null;
  value: string;
  addEventListener(type: string, listener: (event: EditorEvent) => void): void;
  closest<T>(selector: string): T | null;
};

type EditorDocument = {
  querySelector<T>(selector: string): T | null;
  addEventListener(type: string, listener: () => void): void;
};

type DraftHunk = { start: number; count: number; text: string };
type DraftPayload = {
  draft: string;
  git: boolean;
  html: string;
  hunks: DraftHunk[];
  limited: boolean;
};
type EditFetch = (
  url: string,
  options: {
    method: string;
    signal: AbortSignal;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; json(): Promise<DraftPayload> }>;

/** Adds live highlighting and in-memory Git hunk actions to the native form. */
export function installEdit(
  document: EditorDocument,
  fetcher: EditFetch = fetch as unknown as EditFetch,
): void {
  const select = <T extends EditorElement>(selector: string) =>
    document.querySelector<T>(selector);
  const form = select(".edit-page");
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
  if (
    !form?.dataset.editPath || !text || !surface || !pre || !code || !gutter ||
    !details || !diff || !close || !revert || !status
  ) {
    return;
  }
  const path = form.dataset.editPath;
  let controller: AbortController | undefined;
  let generation = 0;
  let hunks: DraftHunk[] = [];
  let selected: number | undefined;
  let timer: number | undefined;
  let diskChanged = false;
  const diskChangedMessage =
    "File changed on disk; your draft is preserved. Save will check for conflicts.";

  const hideDiff = (): void => {
    selected = undefined;
    details.hidden = true;
  };
  const syncScroll = (): void => {
    pre.scrollTop = text.scrollTop;
    pre.scrollLeft = text.scrollLeft;
    gutter.style.transform = `translateY(${-text.scrollTop}px)`;
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
    if (text.value !== payload.draft) {
      text.value = payload.draft;
    }
    code.innerHTML = payload.html;
    renderGutter(payload.hunks);
    hideDiff();
    surface.classList.add("is-enhanced");
    syncScroll();
    if (diskChanged) {
      status.textContent = diskChangedMessage;
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
      const payload = await response.json();
      if (
        mine !== generation || requestController.signal.aborted ||
        text.value !== snapshot
      ) {
        return;
      }
      apply(payload);
    } catch { /* The server-rendered/native editor remains usable. */ }
  };
  const schedule = (): void => {
    status.textContent = diskChanged ? diskChangedMessage : "Editing";
    code.textContent = text.value;
    renderGutter([]);
    hideDiff();
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => update(), 120) as unknown as number;
  };

  text.addEventListener("input", schedule);
  text.addEventListener("scroll", syncScroll);
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
  document.addEventListener("markdown-serve:reload", () => {
    diskChanged = true;
    status.textContent = diskChangedMessage;
  });
  syncScroll();
  void update();
}

export const editClient = `(${installEdit.toString()})(document);`;
