import {
  decodeEditorDocument,
  type EditorDocumentState,
  editorUrlInlineLimit,
  editorUrlStateClient,
  encodeEditorDocument,
} from "./editor-url-state.ts";

type ScalarState = {
  end: number;
  left: number;
  preview: number;
  start: number;
  top: number;
  direction: string;
};

/** Routes editor links without turning a failed persistence attempt into text loss. */
type RouteEvent = {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  preventDefault(): void;
  shiftKey?: boolean;
};
type RouteElement = {
  clientHeight: number;
  classList: { toggle(name: string, force?: boolean): void };
  dataset: Record<string, string | undefined>;
  href: string;
  scrollHeight: number;
  scrollLeft: number;
  scrollTop: number;
  selectionDirection: string;
  selectionEnd: number;
  selectionStart: number;
  textContent: string | null;
  value: string;
  addEventListener(
    type: string,
    listener: (event: RouteEvent) => void,
    options?: boolean,
  ): void;
  action: string;
  dispatchEvent(event: Event): boolean;
  requestSubmit(): void;
  setAttribute(name: string, value: string): void;
  toggleAttribute(name: string, force?: boolean): void;
};
type RouteDocument = {
  addEventListener(type: string, listener: (event: Event) => void): void;
  dispatchEvent(event: Event): boolean;
  querySelector<T extends RouteElement>(selector: string): T | null;
  querySelectorAll<T extends RouteElement>(selector: string): Iterable<T>;
};
type RouteWindow = {
  addEventListener(type: string, listener: () => void): void;
  history: {
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
    replaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void;
  };
  location: { hash: string; href: string };
  sessionStorage: Storage;
  clearTimeout(id: number): void;
  setTimeout(callback: () => void, milliseconds: number): number;
};

export function installEditorRoute(
  document: RouteDocument,
  window: RouteWindow = globalThis as unknown as RouteWindow,
): void {
  const form = document.querySelector<RouteElement>(".edit-page");
  const editor = document.querySelector<RouteElement>(".edit-text");
  const tag = document.querySelector<RouteElement>(
    '.edit-page input[name="etag"]',
  );
  const workspace = document.querySelector<RouteElement>(".edit-workspace");
  const preview = document.querySelector<RouteElement>(
    ".edit-markdown-preview",
  );
  const status = document.querySelector<RouteElement>(".edit-status");
  if (!form || !editor || !tag || !workspace || !status) return;
  type Layout = "editor" | "split-horizontal" | "split-vertical" | "preview";
  const modes: Record<Layout, string> = {
    editor: "",
    "split-horizontal": "preview-stacked",
    "split-vertical": "preview-side-by-side",
    preview: "preview",
  };
  const initial: EditorDocumentState = {
    v: 1,
    base: editor.value,
    draft: editor.value,
    tag: tag.value,
  };
  let base = initial.base;
  let documentTimer: number | undefined;
  let documentRevision = 0;
  let generation = 0;
  let restoreGeneration = 0;
  let cachedPart = "";
  let fallbackShared = true;
  let persisted = initial;
  let persistedPart = "";
  let provisionalFallback = false;
  let bypassSubmit = false;
  let skipInitialHashUpdate = new URL(window.location.href).searchParams.has(
    "saved",
  );
  const scalar = (): ScalarState => ({
    start: editor.selectionStart,
    end: editor.selectionEnd,
    direction: editor.selectionDirection,
    top: editor.scrollTop,
    left: editor.scrollLeft,
    preview: preview
      ? preview.scrollTop /
        Math.max(1, preview.scrollHeight - preview.clientHeight)
      : 0,
  });
  const fragment = (documentPart: string, values = scalar()) => {
    if (
      !documentPart && !values.start && !values.end && !values.top &&
      !values.left && !values.preview
    ) {
      return "";
    }
    return `${documentPart ? `ms=${documentPart}&` : ""}p=${
      [
        values.start,
        values.end,
        values.direction,
        values.top,
        values.left,
        values.preview,
      ].map(encodeURIComponent).join(",")
    }`;
  };
  const setHash = (documentPart: string, replace: boolean) => {
    const url = new URL(window.location.href);
    url.hash = fragment(documentPart);
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
    for (
      const link of document.querySelectorAll<RouteElement>(
        ".edit-layout-controls a",
      )
    ) {
      const target = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      for (const key of ["theme", "wide"]) {
        if (!target.searchParams.has(key) && current.searchParams.has(key)) {
          target.searchParams.set(key, current.searchParams.get(key)!);
        }
      }
      target.hash = url.hash;
      link.setAttribute("href", `${target.search}${target.hash}`);
    }
    const action = new URL(form.action, window.location.href);
    action.hash = url.hash;
    form.setAttribute(
      "action",
      `${action.pathname}${action.search}${action.hash}`,
    );
  };
  const documentPart = () =>
    new URL(window.location.href).hash.match(/(?:^|[&#])ms=([^&]+)/)?.[1] ?? "";
  const removeFallback = (part: string) => {
    if (!part.startsWith("1.s.")) return;
    try {
      window.sessionStorage.removeItem(`markdown-serve:${part.slice(4)}`);
    } catch { /* Storage cleanup must not affect the draft. */ }
  };
  const storeFallback = (
    payload: EditorDocumentState,
    provisional: boolean,
  ): boolean => {
    const previous = documentPart();
    try {
      const id = previous.startsWith("1.s.") && !fallbackShared
        ? previous.slice(4)
        : crypto.randomUUID();
      window.sessionStorage.setItem(
        `markdown-serve:${id}`,
        JSON.stringify(provisional ? { ...payload, temporary: true } : payload),
      );
      cachedPart = `1.s.${id}`;
      fallbackShared = false;
      persisted = payload;
      persistedPart = cachedPart;
      provisionalFallback = provisional;
      setHash(cachedPart, true);
      return true;
    } catch {
      status.textContent =
        "Draft remains on this page; browser storage is unavailable.";
      return false;
    }
  };
  const persistDocument = async (replace = true): Promise<boolean> => {
    const mine = ++generation;
    if (editor.value === base) {
      const previous = documentPart();
      const removePrevious = previous.startsWith("1.s.") && !fallbackShared;
      cachedPart = "";
      fallbackShared = false;
      persisted = { v: 1, base, draft: editor.value, tag: tag.value };
      persistedPart = "";
      provisionalFallback = false;
      setHash("", replace);
      if (removePrevious) removeFallback(previous);
      return true;
    }
    const payload: EditorDocumentState = {
      v: 1,
      base,
      draft: editor.value,
      tag: tag.value,
    };
    if (
      !provisionalFallback && persistedPart !== "" &&
      (cachedPart || documentPart()) === persistedPart &&
      payload.base === persisted.base &&
      payload.draft === persisted.draft && payload.tag === persisted.tag
    ) {
      setHash(persistedPart, replace);
      return true;
    }
    const compressed = await encodeEditorDocument(payload);
    if (mine !== generation) return false;
    if (
      payload.base !== base || payload.draft !== editor.value ||
      payload.tag !== tag.value
    ) {
      return persistDocument(replace);
    }
    if (compressed && compressed.length <= editorUrlInlineLimit) {
      const previous = documentPart();
      const removePrevious = previous.startsWith("1.s.") && !fallbackShared;
      cachedPart = `1.g.${compressed}`;
      fallbackShared = false;
      persisted = payload;
      persistedPart = cachedPart;
      provisionalFallback = false;
      setHash(cachedPart, replace);
      if (removePrevious) removeFallback(previous);
      return true;
    }
    return storeFallback(payload, false);
  };
  const persistScalar = () => setHash(cachedPart || documentPart(), true);
  const applyLayout = (layout: Layout) => {
    workspace.dataset.editLayout = layout;
    for (
      const link of document.querySelectorAll<RouteElement>(
        ".edit-layout-controls a",
      )
    ) {
      const selected = link.dataset.editLayout === layout;
      link.classList.toggle("is-selected", selected);
      link.toggleAttribute("aria-current", selected);
    }
    document.dispatchEvent(new Event("markdown-serve:editor-layout"));
  };
  const restore = async () => {
    const mine = ++restoreGeneration;
    const revision = documentRevision;
    const url = new URL(window.location.href);
    const mode = Object.entries(modes).find(([, value]) =>
      value === (url.searchParams.get("edit") ?? "")
    )?.[0] as Layout | undefined;
    applyLayout(mode ?? "editor");
    const part = documentPart();
    let state: EditorDocumentState | undefined;
    let restoredProvisional = false;
    if (part.startsWith("1.g.")) {
      state = await decodeEditorDocument(part.slice(4));
    }
    if (mine !== restoreGeneration || revision !== documentRevision) return;
    cachedPart = part;
    provisionalFallback = false;
    state ??= part ? undefined : initial;
    if (part.startsWith("1.s.")) {
      try {
        const raw = window.sessionStorage.getItem(
          `markdown-serve:${part.slice(4)}`,
        );
        const stored = raw
          ? JSON.parse(raw) as EditorDocumentState & { temporary?: unknown }
          : undefined;
        state = stored;
        restoredProvisional = stored?.temporary === true;
      } catch { /* retain server text */ }
    }
    fallbackShared = part.startsWith("1.s.") && !restoredProvisional;
    provisionalFallback = restoredProvisional;
    if (
      state?.v === 1 && typeof state.base === "string" &&
      typeof state.draft === "string" && typeof state.tag === "string"
    ) {
      base = state.base;
      editor.value = state.draft;
      tag.value = state.tag;
      persisted = state;
      persistedPart = part;
      document.dispatchEvent(
        new CustomEvent("markdown-serve:editor-state", { detail: state }),
      );
    } else {
      persistedPart = "";
    }
    const values =
      new URLSearchParams(url.hash.slice(1)).get("p")?.split(",") ??
        [];
    const clamp = (value: string | undefined, maximum: number) =>
      Math.max(0, Math.min(maximum, Number(value) || 0));
    editor.selectionStart = clamp(values[0], editor.value.length);
    editor.selectionEnd = clamp(values[1], editor.value.length);
    editor.selectionDirection = values[2] === "backward"
      ? "backward"
      : "forward";
    editor.scrollTop = clamp(
      values[3],
      Math.max(0, editor.scrollHeight - editor.clientHeight),
    );
    editor.scrollLeft = Math.max(0, Number(values[4]) || 0);
    if (preview) {
      preview.scrollTop = clamp(values[5], 1) *
        Math.max(0, preview.scrollHeight - preview.clientHeight);
    }
    if (skipInitialHashUpdate) {
      skipInitialHashUpdate = false;
    } else {
      setHash(part, true);
    }
    if (restoredProvisional) {
      scheduleDocument();
    }
    document.dispatchEvent(new Event("markdown-serve:editor-layout"));
  };
  const scheduleDocument = () => {
    if (documentTimer) window.clearTimeout(documentTimer);
    documentTimer = window.setTimeout(() => void persistDocument(), 250);
  };
  const documentChanged = () => {
    documentRevision++;
    if (editor.value === base) {
      void persistDocument();
    } else {
      storeFallback(
        { v: 1, base, draft: editor.value, tag: tag.value },
        true,
      );
    }
    scheduleDocument();
  };
  const persistBeforeLeaving = () => {
    if (
      editor.value === base ||
      (editor.value === persisted.draft && base === persisted.base &&
        tag.value === persisted.tag)
    ) {
      return;
    }
    storeFallback({ v: 1, base, draft: editor.value, tag: tag.value }, true);
  };
  const scalarChanged = () => persistScalar();
  editor.addEventListener("input", documentChanged);
  editor.addEventListener("scroll", scalarChanged);
  editor.addEventListener("select", scalarChanged);
  preview?.addEventListener("scroll", scalarChanged);
  for (
    const link of document.querySelectorAll<RouteElement>(
      ".edit-layout-controls a",
    )
  ) {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented) {
        return;
      }
      if (
        event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        persistBeforeLeaving();
        return;
      }
      event.preventDefault();
      if (documentTimer) window.clearTimeout(documentTimer);
      void persistDocument().then((ok: boolean) => {
        if (!ok) {
          status.textContent =
            "Draft remains on this page; browser storage is unavailable, so navigation was stopped.";
          return;
        }
        const target = new URL(link.href);
        target.hash = window.location.hash;
        window.history.pushState(null, "", target);
        fallbackShared = cachedPart.startsWith("1.s.");
        void restore();
      });
    });
    link.addEventListener("auxclick", persistBeforeLeaving);
  }
  document.addEventListener("markdown-serve:editor-base", (event: Event) => {
    const detail = (event as CustomEvent<Partial<EditorDocumentState>>).detail;
    if (typeof detail?.base !== "string" || typeof detail.tag !== "string") {
      return;
    }
    base = detail.base;
    tag.value = detail.tag;
    documentChanged();
  });
  document.addEventListener("markdown-serve:editor-draft", documentChanged);
  form.addEventListener("submit", (event) => {
    if (bypassSubmit || event.defaultPrevented) return;
    event.preventDefault();
    if (documentTimer) window.clearTimeout(documentTimer);
    void persistDocument().then(() => {
      bypassSubmit = true;
      form.requestSubmit();
      bypassSubmit = false;
    });
  }, true);
  if (new URL(window.location.href).searchParams.has("saved")) {
    removeFallback(documentPart());
    cachedPart = "";
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url);
  }
  window.addEventListener("popstate", () => void restore());
  window.addEventListener("beforeunload", persistBeforeLeaving);
  window.addEventListener("pagehide", persistBeforeLeaving);
  void restore();
}

export const editorRouteClient =
  `${editorUrlStateClient}(${installEditorRoute.toString()})(document);`;
