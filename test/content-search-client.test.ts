import { assertEquals } from "@std/assert";
import { installContentSearch } from "../src/server/content-search-client.ts";

Deno.test("repository search client safely loads and navigates results", async () => {
  const document = new FakeDocument();
  const location = {
    href: "http://example.test/docs/",
    assigned: "",
    assign(href: string) {
      this.assigned = href;
    },
  };
  const calls: {
    url: URL;
    signal: AbortSignal;
    resolve: (value: unknown) => void;
  }[] = [];
  installContentSearch(
    document as never,
    location,
    (url, options) =>
      new Promise((resolve) =>
        calls.push({ url, signal: options.signal, resolve })
      ) as never,
  );
  document.key("/", document.body);
  const dialog = document.element("dialog")!;
  const input = document.element("input")!;
  assertEquals([
    dialog.open,
    input.focused,
    dialog.querySelector("legend")?.textContent,
  ], [true, true, "Search options"]);
  await wait(190);
  assertEquals(calls.length, 0);
  input.value = "needle";
  input.event("input", input);
  await wait(190);
  assertEquals(calls.length, 1);
  const url = calls[0].url;
  assertEquals([
    url.searchParams.get("path"),
    url.searchParams.get("search"),
    url.searchParams.get("smartCase"),
    url.searchParams.get("context"),
  ], ["docs", "needle", "1", "0"]);
  const controls = dialog.querySelectorAll("input");
  controls.find((value) => value.name === "fixed")!.checked = true;
  controls.find((value) => value.name === "glob")!.value = "*.ts";
  controls.find((value) => value.name === "type")!.value = "ts";
  calls[0].resolve({
    ok: true,
    json: () =>
      Promise.resolve([{
        path: "<safe>",
        line: 2,
        text: "<script>",
        context: [{ line: 1, text: "<b>" }],
        href: "/a#L2",
      }, { path: "b", line: 3, text: "two", href: "/b#L3" }]),
  });
  await Promise.resolve();
  await Promise.resolve();
  const link = dialog.querySelector("a")!;
  assertEquals([link.textContent, link.children[0].textContent], [
    "<safe>:2  <script>",
    "1: <b>",
  ]);
  input.event("keydown", input, "ArrowDown");
  assertEquals([
    dialog.querySelectorAll("li")[1].attributes.get("data-selected"),
    dialog.querySelectorAll("a")[1].scrolled,
  ], ["", 1]);
  input.event("keydown", input, "Enter");
  assertEquals(location.assigned, "/b#L3");
  input.value = "next";
  input.event("input", input);
  await wait(190);
  assertEquals(calls[1].url.searchParams.get("fixed"), "1");
  assertEquals([
    calls[1].url.searchParams.get("glob"),
    calls[1].url.searchParams.get("type"),
  ], ["*.ts", "ts"]);
  input.value = "last";
  input.event("input", input);
  await wait(190);
  assertEquals(calls[1].signal.aborted, true);
  calls[1].resolve({ ok: false, json: () => Promise.resolve([]) });
  calls[2].resolve({ ok: true, json: () => Promise.resolve([]) });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(dialog.querySelector("p")!.textContent, "No results");
  input.value = "escape";
  input.event("input", input);
  await wait(190);
  input.event("keydown", input, "Escape");
  assertEquals([dialog.open, calls[3].signal.aborted], [false, true]);
  document.key("/", document.body);
  input.value = "failure";
  input.event("input", input);
  await wait(190);
  calls[4].resolve({ ok: false, json: () => Promise.resolve([]) });
  await Promise.resolve();
  await Promise.resolve();
  assertEquals(dialog.querySelector("p")!.textContent, "Search unavailable");
  dialog.close();
  const button = document.createElement("button");
  const child = document.createElement("span");
  button.append(child);
  document.key("/", child);
  assertEquals(dialog.open, false);
});

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

class FakeDocument {
  body = new FakeElement("body");
  listeners = new Map<string, ((event: FakeEvent) => void)[]>();
  createElement(name: string) {
    return new FakeElement(name);
  }
  addEventListener(type: string, listener: (event: FakeEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  key(key: string, target: FakeElement) {
    this.event("keydown", target, key);
  }
  event(type: string, target: FakeElement, key = "") {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new FakeEvent(type, target, key));
    }
  }
  element(name: string) {
    return this.body.all().find((value) => value.tag === name);
  }
}
class FakeElement {
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  dataset: Record<string, string> = {};
  listeners = new Map<string, ((event: FakeEvent) => void)[]>();
  parent?: FakeElement;
  autocomplete = "";
  checked = false;
  className = "";
  href = "";
  max = "";
  min = "";
  name = "";
  placeholder = "";
  textContent = "";
  type = "";
  value = "";
  open = false;
  focused = false;
  scrolled = 0;
  constructor(readonly tag: string) {
    if (tag === "body") this.dataset.contentSearchScope = "docs";
  }
  append(...values: (FakeElement | string)[]) {
    for (const value of values) {
      if (typeof value === "string") this.textContent += value;
      else {
        value.parent = this;
        this.children.push(value);
      }
    }
  }
  addEventListener(type: string, listener: (event: FakeEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  event(type: string, target: FakeElement, key = "") {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(new FakeEvent(type, target, key));
    }
    this.parent?.event(type, target, key);
  }
  dispatchEvent(event: Event) {
    this.event(event.type, this);
    return true;
  }
  close() {
    this.open = false;
    this.event("close", this);
  }
  focus() {
    this.focused = true;
  }
  showModal() {
    this.open = true;
  }
  replaceChildren(...values: FakeElement[]) {
    this.children = [];
    this.append(...values);
  }
  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }
  toggleAttribute(name: string, force = !this.attributes.has(name)) {
    if (force) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return force;
  }
  scrollIntoView() {
    this.scrolled++;
  }
  closest(selector: string) {
    return this.ancestors().find((value) => selector.includes(value.tag)) ??
      null;
  }
  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string) {
    return this.all().filter((value) =>
      selector === value.tag ||
      (selector === '[data-selected="true"]' &&
        value.attributes.has("data-selected"))
    );
  }
  all(): FakeElement[] {
    return this.children.flatMap((value) => [value, ...value.all()]);
  }
  ancestors(): FakeElement[] {
    return [this, ...(this.parent?.ancestors() ?? [])];
  }
}
class FakeEvent {
  altKey = false;
  ctrlKey = false;
  metaKey = false;
  shiftKey = false;
  prevented = false;
  constructor(
    readonly type: string,
    readonly target: FakeElement,
    readonly key = "",
  ) {}
  preventDefault() {
    this.prevented = true;
  }
}
