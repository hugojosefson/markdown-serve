type EditElement = {
  dataset: Record<string, string | undefined>;
  value: string;
  textContent: string | null;
  hidden: boolean;
  open: boolean;
  close(): void;
  showModal(): void;
  addEventListener(
    type: string,
    listener: (event: { preventDefault(): void }) => void,
  ): void;
  querySelector<T extends EditElement>(selector: string): T | null;
};
type EditDocument = {
  querySelector<T extends EditElement>(selector: string): T | null;
  addEventListener(type: string, listener: () => void): void;
};
type EditFetch = (
  url: string,
  options: {
    signal: AbortSignal;
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<
  {
    ok: boolean;
    status: number;
    headers: { get(name: string): string | null };
    text(): Promise<string>;
  }
>;

export function installEdit(document: EditDocument, fetcher: EditFetch): void {
  const button = document.querySelector<EditElement>(".edit-file");
  const dialog = document.querySelector<EditElement>(".edit-dialog");
  if (!button || !dialog) return;
  const text = dialog.querySelector<EditElement>(".edit-text")!;
  const status = dialog.querySelector<EditElement>(".edit-status")!;
  const cancel = dialog.querySelector<EditElement>(".edit-cancel")!;
  const save = dialog.querySelector<EditElement>(".edit-save")!;
  const reload = dialog.querySelector<EditElement>(".edit-reload")!;
  const endpoint = "/__markdown_serve__/edit?path=" +
    encodeURIComponent(button.dataset.editPath ?? "");
  let loadController: AbortController | undefined,
    saveController: AbortController | undefined,
    loadGeneration = 0,
    saveGeneration = 0,
    etag: string | null = null;
  const isAbortError = (error: unknown) =>
    error instanceof DOMException && error.name === "AbortError";
  const state = (message: string) => status.textContent = message;
  const cancelEdit = () => {
    ++loadGeneration;
    ++saveGeneration;
    loadController?.abort();
    saveController?.abort();
    dialog.close();
  };
  const load = async () => {
    const mine = ++loadGeneration;
    ++saveGeneration;
    loadController?.abort();
    saveController?.abort();
    const controller = loadController = new AbortController();
    etag = null;
    text.value = "";
    state("Loading…");
    reload.hidden = true;
    if (!dialog.open) dialog.showModal();
    try {
      const response = await fetcher(endpoint, { signal: controller.signal });
      if (
        mine !== loadGeneration || loadController !== controller || !response.ok
      ) throw new Error("unavailable");
      const nextTag = response.headers.get("etag");
      const value = await response.text();
      if (mine !== loadGeneration || loadController !== controller) return;
      if (!nextTag) throw new Error("missing tag");
      etag = nextTag;
      text.value = value;
      state("Ready");
    } catch (error) {
      if (
        mine === loadGeneration && loadController === controller &&
        !isAbortError(error)
      ) state("Could not load file");
    }
  };
  const saveEdit = async () => {
    if (!etag) return;
    const mine = ++saveGeneration;
    saveController?.abort();
    const controller = saveController = new AbortController();
    state("Saving…");
    try {
      const response = await fetcher(endpoint, {
        method: "PUT",
        signal: controller.signal,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "If-Match": etag,
        },
        body: text.value,
      });
      if (mine !== saveGeneration || saveController !== controller) return;
      if (response.status === 412) {
        state("Conflict: reload before retrying");
        reload.hidden = false;
        return;
      }
      if (!response.ok) throw new Error("unavailable");
      const nextTag = response.headers.get("etag");
      if (!nextTag) throw new Error("missing tag");
      etag = nextTag;
      state("Saved");
      dialog.close();
    } catch (error) {
      if (
        mine === saveGeneration && saveController === controller &&
        !isAbortError(error)
      ) state("Could not save file");
    }
  };
  button.addEventListener("click", load);
  cancel.addEventListener("click", cancelEdit);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    cancelEdit();
  });
  save.addEventListener("click", saveEdit);
  reload.addEventListener("click", load);
  document.addEventListener(
    "markdown-serve:reload",
    () => state("Changes detected; reload after saving or canceling"),
  );
}
export const editClient = `(${installEdit.toString()})(document, fetch);`;
