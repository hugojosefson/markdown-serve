import { assertEquals, assertMatch } from "@std/assert";
import { installEdit } from "../src/server/edit-client.ts";

type Event = { target?: Element };

class Element {
  classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  classes = new Set<string>();
  dataset: Record<string, string | undefined> = {};
  disabled = false;
  hidden = false;
  innerHTML = "";
  scrollLeft = 0;
  scrollTop = 0;
  style = { transform: "" };
  textContent: string | null = "";
  value = "";
  readonly listeners = new Map<string, ((event: Event) => void)[]>();
  addEventListener(type: string, listener: (event: Event) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  closest<T>(_selector: string): T | null {
    return this as unknown as T;
  }
  fire(type: string, target: Element = this): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ target });
    }
  }
}

function editor() {
  const elements = {
    form: new Element(),
    text: new Element(),
    surface: new Element(),
    pre: new Element(),
    code: new Element(),
    gutter: new Element(),
    details: new Element(),
    diff: new Element(),
    close: new Element(),
    revert: new Element(),
    status: new Element(),
  };
  elements.form.dataset.editPath = "guide.md";
  elements.text.value = "# draft\n";
  elements.details.hidden = true;
  const selectors = new Map<string, Element>([
    [".edit-page", elements.form],
    [".edit-text", elements.text],
    [".edit-surface", elements.surface],
    [".edit-highlight", elements.pre],
    [".edit-highlight code", elements.code],
    [".edit-gutter", elements.gutter],
    [".edit-hunk-details", elements.details],
    [".edit-hunk-details pre", elements.diff],
    [".edit-hunk-close", elements.close],
    [".edit-hunk-revert", elements.revert],
    [".edit-status", elements.status],
  ]);
  const listeners = new Map<string, () => void>();
  const document = {
    querySelector: (selector: string) => selectors.get(selector) ?? null,
    addEventListener: (type: string, listener: () => void) =>
      listeners.set(type, listener),
  };
  return {
    ...elements,
    document: document as unknown as Parameters<typeof installEdit>[0],
    fireDocument: (type: string) => listeners.get(type)?.(),
  };
}

const payload = (
  draft: string,
  hunks: Array<{ start: number; count: number; text: string }> = [],
) => ({
  draft,
  git: true,
  html: `<span class="token">${draft.trim()}</span>`,
  hunks,
  limited: false,
});

Deno.test("edit enhancement is absent without an edit page", () => {
  installEdit({ querySelector: () => null, addEventListener() {} }, () => {
    throw new Error("must not fetch");
  });
});

Deno.test("edit enhancement highlights, inspects, and reverts a Git hunk in memory", async () => {
  const ui = editor();
  const calls: Array<{ url: string; body: string }> = [];
  installEdit(ui.document, (url, options) => {
    calls.push({ url, body: options.body });
    const response = url.includes("revert=0")
      ? payload("# head\n")
      : payload("# draft\n", [{
        start: 1,
        count: 1,
        text: "@@ -1 +1 @@\n-# head\n+# draft",
      }]);
    return Promise.resolve({ ok: true, json: () => Promise.resolve(response) });
  });
  await Promise.resolve();
  await Promise.resolve();

  assertEquals(ui.surface.classes.has("is-enhanced"), true);
  assertMatch(ui.code.innerHTML, /token/);
  assertMatch(ui.gutter.innerHTML, /data-edit-hunk="0"/);
  const marker = new Element();
  marker.dataset.editHunk = "0";
  ui.gutter.fire("click", marker);
  assertEquals([ui.details.hidden, ui.diff.textContent], [
    false,
    "@@ -1 +1 @@\n-# head\n+# draft",
  ]);

  ui.revert.fire("click");
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(ui.text.value, "# head\n");
  assertEquals(calls.at(-1), {
    url: "/__markdown_serve__/highlight?path=guide.md&revert=0",
    body: "# draft\n",
  });
  assertEquals(ui.gutter.innerHTML, "");
});

Deno.test("edit enhancement keeps native text current and reports disk changes", async () => {
  const ui = editor();
  installEdit(ui.document, () =>
    Promise.resolve({
      ok: false,
      json: () => Promise.resolve(payload("")),
    }));
  assertEquals(ui.surface.classes.has("is-enhanced"), false);
  ui.text.value = "new & visible";
  ui.text.fire("input");
  assertEquals(ui.code.textContent, "new & visible");
  ui.text.scrollTop = 30;
  ui.text.scrollLeft = 12;
  ui.text.fire("scroll");
  assertEquals(
    [ui.pre.scrollTop, ui.pre.scrollLeft, ui.gutter.style.transform],
    [30, 12, "translateY(-30px)"],
  );
  ui.fireDocument("markdown-serve:reload");
  assertMatch(ui.status.textContent!, /draft is preserved/);
  await new Promise((resolve) => setTimeout(resolve, 140));
  assertEquals(ui.surface.classes.has("is-enhanced"), false);
});

Deno.test("edit enhancement does not overwrite typing during hunk revert", async () => {
  const ui = editor();
  let finishRevert:
    | ((
      value: { ok: boolean; json(): Promise<ReturnType<typeof payload>> },
    ) => void)
    | undefined;
  installEdit(ui.document, (url) => {
    if (url.includes("revert=0")) {
      return new Promise((resolve) => finishRevert = resolve);
    }
    return Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve(payload("# draft\n", [{
          start: 1,
          count: 1,
          text: "@@ -1 +1 @@\n-# head\n+# draft",
        }])),
    });
  });
  await Promise.resolve();
  await Promise.resolve();
  const marker = new Element();
  marker.dataset.editHunk = "0";
  ui.gutter.fire("click", marker);
  ui.revert.fire("click");
  ui.text.value = "typed while reverting";
  ui.text.fire("input");
  finishRevert?.({
    ok: true,
    json: () => Promise.resolve(payload("# head\n")),
  });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(ui.text.value, "typed while reverting");
});
