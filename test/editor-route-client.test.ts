import { assert, assertEquals } from "@std/assert";
import {
  editorRouteClient,
  installEditorRoute,
} from "../src/server/editor-route-client.ts";
import {
  decodeEditorDocument,
  encodeEditorDocument,
} from "../src/server/editor-url-state.ts";

type Listener = { listener: (event: Event) => void; options?: boolean };

class FakeTarget {
  readonly listeners = new Map<string, Listener[]>();

  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: boolean,
  ) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ listener, options });
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event: Event): boolean {
    for (const { listener } of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    return !event.defaultPrevented;
  }

  emit(type: string, values: Record<string, unknown> = {}) {
    const event = {
      type,
      defaultPrevented: false,
      preventDefault() {
        event.defaultPrevented = true;
      },
      ...values,
    };
    for (const { listener } of this.listeners.get(type) ?? []) {
      listener(event as unknown as Event);
    }
    return event;
  }
}

class FakeElement extends FakeTarget {
  action = "";
  clientHeight = 100;
  classList = {
    toggle: (name: string, value?: boolean) => this.classes.set(name, !!value),
  };
  dataset: Record<string, string | undefined> = {};
  private readonly classes = new Map<string, boolean>();
  private hrefValue = "";
  private readonly attributes = new Map<string, string>();
  onRequestSubmit?: () => void;
  requestSubmits = 0;
  scrollHeight = 500;
  scrollLeft = 0;
  scrollTop = 0;
  selectionDirection = "forward";
  selectionEnd = 0;
  selectionStart = 0;
  textContent: string | null = "";
  value = "";

  constructor(private readonly origin: string) {
    super();
  }

  get href() {
    return new URL(this.hrefValue, this.origin).href;
  }

  set href(value: string) {
    this.hrefValue = value;
  }

  hasClass(name: string) {
    return this.classes.get(name) ?? false;
  }

  requestSubmit() {
    this.requestSubmits++;
    this.onRequestSubmit?.();
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "href") this.href = value;
    if (name === "action") this.action = value;
  }

  toggleAttribute(name: string, force?: boolean) {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
  }
}

class FakeStorage {
  readonly values = new Map<string, string>();
  fail = false;
  removed: string[] = [];

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  removeItem(key: string) {
    this.removed.push(key);
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    if (this.fail) throw new Error("blocked");
    this.values.set(key, value);
  }
}

class FakeWindow extends FakeTarget {
  readonly history: {
    pushState: (_: unknown, unused: string, url?: string | URL | null) => void;
    replaceState: (
      _: unknown,
      unused: string,
      url?: string | URL | null,
    ) => void;
  };
  readonly location: { href: string; hash: string };
  readonly sessionStorage = new FakeStorage();
  readonly changes: { kind: string; href: string }[] = [];
  private readonly timers = new Map<number, () => void>();
  private timer = 0;

  constructor(href: string) {
    super();
    let current = href;
    this.location = {} as { href: string; hash: string };
    Object.defineProperties(this.location, {
      href: { get: () => current, set: (value: string) => current = value },
      hash: {
        get: () => new URL(current).hash,
        set: (value: string) => {
          const url = new URL(current);
          url.hash = value;
          current = url.href;
        },
      },
    });
    const change = (kind: string, url?: string | URL | null) => {
      if (url) current = new URL(url.toString(), current).href;
      this.changes.push({ kind, href: current });
    };
    this.history = {
      pushState: (_, _unused, url) => change("push", url),
      replaceState: (_, _unused, url) => change("replace", url),
    };
  }

  clearTimeout(id: number) {
    this.timers.delete(id);
  }

  runTimers() {
    for (const [id, callback] of [...this.timers]) {
      this.timers.delete(id);
      callback();
    }
  }

  setTimeout(callback: () => void, _milliseconds: number) {
    const id = ++this.timer;
    this.timers.set(id, callback);
    return id;
  }
}

function harness(href = "https://test.invalid/edit?theme=dark&wide=1") {
  const window = new FakeWindow(href);
  const origin = "https://test.invalid";
  const form = new FakeElement(origin);
  form.action = "/edit?theme=dark&wide=1";
  const editor = new FakeElement(origin);
  editor.value = "server\r\ntext";
  const tag = new FakeElement(origin);
  tag.value = "server-tag";
  const workspace = new FakeElement(origin);
  const preview = new FakeElement(origin);
  const status = new FakeElement(origin);
  const links = ["editor", "split-horizontal", "split-vertical", "preview"].map(
    (layout) => {
      const link = new FakeElement(origin);
      link.dataset.editLayout = layout;
      link.href = `/edit?edit=${layout === "editor" ? "" : layout}`;
      return link;
    },
  );
  const document = new FakeTarget() as FakeTarget & {
    querySelector<T>(selector: string): T | null;
    querySelectorAll<T>(selector: string): Iterable<T>;
  };
  document.querySelector = <T>(selector: string) =>
    ({
      ".edit-page": form,
      ".edit-text": editor,
      '.edit-page input[name="etag"]': tag,
      ".edit-workspace": workspace,
      ".edit-markdown-preview": preview,
      ".edit-status": status,
    }[selector] ?? null) as T | null;
  document.querySelectorAll = <T>(selector: string) =>
    (selector === ".edit-layout-controls a" ? links : []) as T[];
  return {
    document,
    editor,
    form,
    links,
    preview,
    status,
    tag,
    window,
    workspace,
  };
}

async function settle() {
  await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
}

function part(href: string) {
  return new URL(href).hash.match(/ms=([^&]+)/)?.[1] ?? "";
}

Deno.test("installEditorRoute restores server layout and clamps scalar hashes", async () => {
  const h = harness(
    "https://test.invalid/edit?edit=preview#p=999,-3,sideways,999,-1,9",
  );
  installEditorRoute(h.document, h.window as never);
  assertEquals(h.workspace.dataset.editLayout, "preview");
  assert(h.links[3].hasClass("is-selected"));
  assertEquals([h.editor.selectionStart, h.editor.selectionEnd], [12, 0]);
  assertEquals([h.editor.scrollTop, h.editor.scrollLeft, h.preview.scrollTop], [
    400,
    0,
    400,
  ]);
  h.window.location.hash = "#p=broken";
  h.window.emit("popstate");
  await settle();
  assertEquals([
    h.editor.selectionStart,
    h.editor.selectionEnd,
    h.editor.scrollTop,
  ], [0, 0, 0]);
});

Deno.test("installEditorRoute persists dirty Unicode drafts before plain layout routes", async () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  h.editor.value = "small 😀\r\n日本語";
  h.editor.selectionStart = 2;
  h.editor.selectionEnd = 8;
  h.links[2].emit("click", { button: 0 });
  await settle();
  const saved = part(h.window.location.href);
  assert(saved.startsWith("1.g."));
  assertEquals(await decodeEditorDocument(saved.slice(4)), {
    v: 1,
    base: "server\r\ntext",
    draft: "small 😀\r\n日本語",
    tag: "server-tag",
  });
  assertEquals(
    new URL(h.window.location.href).searchParams.get("edit"),
    "split-vertical",
  );
  for (const link of h.links) {
    const url = new URL(link.href);
    assertEquals([
      url.searchParams.get("theme"),
      url.searchParams.get("wide"),
      url.hash,
    ], ["dark", "1", `#ms=${saved}&p=2,8,forward,0,0,0`]);
  }
  assertEquals(
    new URL(h.form.action, "https://test.invalid").hash,
    `#ms=${saved}&p=2,8,forward,0,0,0`,
  );
  assert(h.window.changes.some((change) => change.kind === "push"));

  h.editor.value = "first";
  h.editor.emit("input");
  h.editor.value = "last";
  h.editor.emit("input");
  h.window.runTimers();
  await settle();
  assertEquals(
    (await decodeEditorDocument(part(h.window.location.href).slice(4)))?.draft,
    "last",
  );
});

Deno.test("installEditorRoute restores independent inline popstate documents and scalar state", async () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  const encoded = await encodeEditorDocument({
    v: 1,
    base: "base B",
    draft: "draft B",
    tag: "tag B",
  });
  h.window.location.href =
    `https://test.invalid/edit?edit=preview-stacked#ms=1.g.${encoded}&p=2,5,backward,90,7,.5`;
  h.window.emit("popstate");
  await settle();
  assertEquals([h.editor.value, h.tag.value, h.workspace.dataset.editLayout], [
    "draft B",
    "tag B",
    "split-horizontal",
  ]);
  assertEquals([
    h.editor.selectionStart,
    h.editor.selectionEnd,
    h.editor.selectionDirection,
  ], [2, 5, "backward"]);
  assertEquals([h.editor.scrollTop, h.editor.scrollLeft, h.preview.scrollTop], [
    90,
    7,
    200,
  ]);
});

Deno.test("installEditorRoute does not overwrite typing during asynchronous restore", async () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  const encoded = await encodeEditorDocument({
    v: 1,
    base: "old base",
    draft: "old historical draft",
    tag: "old tag",
  });
  h.window.location.href = `https://test.invalid/edit#ms=1.g.${encoded}`;
  h.window.emit("popstate");
  h.editor.value = "typing after navigation";
  h.editor.emit("input");
  await settle();
  assertEquals(h.editor.value, "typing after navigation");
});

Deno.test("installEditorRoute synchronously safeguards and then compresses input", async () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  h.editor.value = "input before debounce";
  h.editor.emit("input");
  const fallback = part(h.window.location.href);
  assert(fallback.startsWith("1.s."));
  assertEquals(
    JSON.parse(
      h.window.sessionStorage.getItem(
        `markdown-serve:${fallback.slice(4)}`,
      )!,
    ).draft,
    "input before debounce",
  );
  assertEquals(
    JSON.parse(
      h.window.sessionStorage.getItem(
        `markdown-serve:${fallback.slice(4)}`,
      )!,
    ).temporary,
    true,
  );
  h.window.runTimers();
  await settle();
  assert(part(h.window.location.href).startsWith("1.g."));
  assertEquals(
    h.window.sessionStorage.getItem(`markdown-serve:${fallback.slice(4)}`),
    null,
  );
});

Deno.test("installEditorRoute leaves modified and non-primary layout clicks native", () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  h.editor.value = "pending modified-link draft";
  h.editor.emit("input");
  for (
    const values of [{ button: 1 }, { button: 0, ctrlKey: true }, {
      button: 0,
      metaKey: true,
    }]
  ) {
    const event = h.links[1].emit("click", values);
    assertEquals(event.defaultPrevented, false);
    assert(new URL(h.links[1].href).hash.startsWith("#ms=1.s."));
  }
  const auxiliary = h.links[1].emit("auxclick", { button: 1 });
  assertEquals(auxiliary.defaultPrevented, false);
  assertEquals(
    h.window.changes.some((change) => change.kind === "push"),
    false,
  );
});

Deno.test("installEditorRoute keeps fallback history immutable while storage failure stops routing", async () => {
  const h = harness();
  installEditorRoute(h.document, h.window as never);
  let random = 1;
  h.editor.value = Array.from({ length: 40_000 }, () => {
    random = (random * 16_807) % 2_147_483_647;
    return String.fromCharCode(0x20 + random % 0xd7c0);
  }).join("");
  h.links[1].emit("click", { button: 0 });
  await settle();
  const fallback = part(h.window.location.href);
  assert(fallback.startsWith("1.s."));
  assert(
    h.window.sessionStorage.values.has(`markdown-serve:${fallback.slice(4)}`),
  );
  h.editor.value += "!";
  h.links[2].emit("click", { button: 0 });
  await settle();
  const nextFallback = part(h.window.location.href);
  assert(nextFallback.startsWith("1.s."));
  assert(nextFallback !== fallback);
  assert(
    h.window.sessionStorage.values.has(`markdown-serve:${fallback.slice(4)}`),
  );
  assert(
    h.window.sessionStorage.values.has(
      `markdown-serve:${nextFallback.slice(4)}`,
    ),
  );

  const blocked = harness();
  installEditorRoute(blocked.document, blocked.window as never);
  blocked.window.sessionStorage.fail = true;
  blocked.editor.value = h.editor.value;
  blocked.links[1].emit("click", { button: 0 });
  await settle();
  assertEquals(
    new URL(blocked.window.location.href).searchParams.get("edit"),
    null,
  );
  assertEquals(blocked.editor.value, h.editor.value);
  assertEquals(
    blocked.status.textContent,
    "Draft remains on this page; browser storage is unavailable, so navigation was stopped.",
  );
});

Deno.test("installEditorRoute captures submit, persists first, and clears saved fallback", async () => {
  const h = harness("https://test.invalid/edit?saved=1#ms=1.s.old");
  h.window.sessionStorage.values.set("markdown-serve:old", "old");
  installEditorRoute(h.document, h.window as never);
  assertEquals(h.window.location.hash, "");
  assertEquals(h.window.sessionStorage.removed, ["markdown-serve:old"]);
  assertEquals(h.form.listeners.get("submit")?.[0].options, true);
  h.editor.value = "submitted";
  let hashAtSubmit = "";
  h.form.onRequestSubmit = () => hashAtSubmit = h.window.location.hash;
  h.form.emit("submit");
  await settle();
  assertEquals(h.form.requestSubmits, 1);
  assert(hashAtSubmit.startsWith("#ms=1.g."));
  assert(part(h.window.location.href).startsWith("1.g."));
});

Deno.test("editor URL document payload round-trips Unicode and line endings", async () => {
  const input = {
    v: 1 as const,
    base: "å\r\n",
    draft: "😀\n日本語\r\n",
    tag: '"etag"',
  };
  const encoded = await encodeEditorDocument(input);
  assertEquals(typeof encoded, "string");
  assertEquals(await decodeEditorDocument(encoded!), input);
});

Deno.test("editor URL document decoder rejects malformed and incompatible payloads", async () => {
  assertEquals(await decodeEditorDocument("not-base64"), undefined);
});

Deno.test("generated editor route client is valid JavaScript", () => {
  assertEquals(typeof new Function(editorRouteClient), "function");
});
