import { assertEquals } from "@std/assert";
import { installEdit } from "../src/server/edit-client.ts";

type Listener = (event: { preventDefault(): void }) => void;

class Element {
  dataset: Record<string, string | undefined> = {};
  value = "";
  textContent: string | null = "";
  hidden = false;
  open = false;
  showCalls = 0;
  readonly listeners = new Map<string, Listener[]>();
  readonly children = new Map<string, Element>();
  close(): void {
    this.open = false;
    this.fire("close");
  }
  showModal(): void {
    if (this.open) throw new Error("already open");
    this.showCalls++;
    this.open = true;
  }
  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  querySelector<T extends Element>(selector: string): T | null {
    return (this.children.get(selector) ?? null) as T | null;
  }
  fire(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ preventDefault() {} });
    }
  }
}

function editor() {
  const button = new Element();
  button.dataset.editPath = "note.txt";
  const dialog = new Element();
  const text = new Element();
  const status = new Element();
  const cancel = new Element();
  const save = new Element();
  const reload = new Element();
  for (
    const [name, value] of Object.entries({
      ".edit-text": text,
      ".edit-status": status,
      ".edit-cancel": cancel,
      ".edit-save": save,
      ".edit-reload": reload,
    })
  ) dialog.children.set(name, value);
  const document = {
    querySelector<T extends Element>(selector: string): T | null {
      return (selector === ".edit-file"
        ? button
        : selector === ".edit-dialog"
        ? dialog
        : null) as T | null;
    },
    addEventListener() {},
  };
  return {
    button,
    dialog,
    text,
    status,
    cancel,
    save,
    reload,
    document: document as unknown as Parameters<typeof installEdit>[0],
  };
}

const response = (
  status: number,
  text = "",
  etag: string | null = '"tag"',
) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (name: string) => name === "etag" ? etag : null },
  text: () => Promise.resolve(text),
});

Deno.test("edit client is a no-op when editor UI is absent", () => {
  installEdit({ querySelector: () => null, addEventListener() {} }, () => {
    throw new Error("must not fetch");
  });
});

Deno.test("edit client loads, saves, and reloads a conflict without reopening", async () => {
  const ui = editor();
  const calls: Array<
    { method?: string; body?: string; headers?: Record<string, string> }
  > = [];
  let saves = 0;
  installEdit(ui.document, (_url, options) => {
    calls.push(options);
    if (options.method !== "PUT") {
      return Promise.resolve(response(200, "safe text", '"one"'));
    }
    return Promise.resolve(
      ++saves === 1 ? response(412) : response(204, "", '"two"'),
    );
  });
  ui.button.fire("click");
  await Promise.resolve();
  await Promise.resolve();
  assertEquals([ui.text.value, ui.status.textContent, ui.dialog.open], [
    "safe text",
    "Ready",
    true,
  ]);
  ui.text.value = "local edit";
  ui.save.fire("click");
  await Promise.resolve();
  assertEquals([ui.text.value, ui.status.textContent, ui.reload.hidden], [
    "local edit",
    "Conflict: reload before retrying",
    false,
  ]);
  ui.reload.fire("click");
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(ui.dialog.showCalls, 1);
  ui.text.value = "replacement";
  ui.save.fire("click");
  await Promise.resolve();
  assertEquals(
    calls.filter((call) => call.method === "PUT").map((
      call,
    ) => [call.headers?.["If-Match"], call.body]),
    [['"one"', "local edit"], ['"one"', "replacement"]],
  );
  assertEquals(ui.dialog.open, false);
});

Deno.test("edit client discards stale load and save results", async () => {
  const ui = editor();
  const first = Promise.withResolvers<ReturnType<typeof response>>();
  let gets = 0;
  installEdit(ui.document, (_url, options) => {
    if (options.method === "PUT") return Promise.resolve(response(500));
    return ++gets === 1
      ? first.promise
      : Promise.resolve(response(200, "new", '"new"'));
  });
  ui.button.fire("click");
  ui.button.fire("click");
  first.resolve(response(200, "old", '"old"'));
  await Promise.resolve();
  await Promise.resolve();
  assertEquals([ui.text.value, ui.status.textContent], ["new", "Ready"]);
});

Deno.test("edit client cancels requests and reports unknown HTTP failures", async () => {
  const ui = editor();
  let signal: AbortSignal | undefined;
  installEdit(ui.document, (_url, options) => {
    signal = options.signal;
    return Promise.resolve(response(500));
  });
  ui.button.fire("click");
  await Promise.resolve();
  assertEquals(ui.status.textContent, "Could not load file");
  ui.button.fire("click");
  ui.cancel.fire("click");
  assertEquals([signal?.aborted, ui.dialog.open], [true, false]);
  ui.dialog.open = true;
  ui.dialog.fire("cancel");
  assertEquals(ui.dialog.open, false);
});

Deno.test("edit client ignores a completed save after cancellation", async () => {
  const ui = editor();
  const pending = Promise.withResolvers<ReturnType<typeof response>>();
  let loaded = false;
  installEdit(ui.document, (_url, options) => {
    if (!options.method) {
      return Promise.resolve(response(200, "original", '"one"'));
    }
    if (!loaded) throw new Error("load did not finish");
    return pending.promise;
  });
  ui.button.fire("click");
  await Promise.resolve();
  await Promise.resolve();
  loaded = true;
  ui.save.fire("click");
  ui.cancel.fire("click");
  pending.resolve(response(204, "", '"two"'));
  await Promise.resolve();
  assertEquals([ui.dialog.open, ui.status.textContent], [false, "Saving…"]);
});
