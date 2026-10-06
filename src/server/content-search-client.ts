import { installDialogDismissal } from "./dialog-dismissal-client.ts";

export function installContentSearch(
  document: ClientDocument,
  location: ClientLocation,
  fetch: ClientFetch,
  signal?: AbortSignal,
): void {
  const scope = document.body?.dataset.contentSearchScope;
  if (scope === undefined) return;
  let search: { dialog: ClientElement; input: ClientElement } | undefined;
  const open = () => {
    if (!search) search = createSearch(document, location, fetch, scope);
    const { dialog, input } = search;
    if (!dialog.open) dialog.showModal();
    input.value = "";
    input.dispatchEvent(new Event("input"));
    input.focus();
  };
  document.addEventListener("keydown", (event) => {
    const target = event.target;
    if (
      event.key !== "/" || event.altKey || event.ctrlKey || event.metaKey ||
      event.shiftKey ||
      target?.closest(
        "a, input, textarea, select, button, [contenteditable]",
      )
    ) return;
    event.preventDefault();
    open();
  }, signal ? { signal } : undefined);
  signal?.addEventListener("abort", () => {
    if (search?.dialog.open) search.dialog.close();
    search = undefined;
  }, { once: true });
}

function createSearch(
  document: ClientDocument,
  location: ClientLocation,
  fetch: ClientFetch,
  scope: string,
): { dialog: ClientElement; input: ClientElement } {
  const dialog = document.createElement("dialog");
  dialog.className = "content-search";
  dialog.dataset.turboTemporary = "";
  const form = document.createElement("form");
  const input = document.createElement("input");
  input.type = "search";
  input.placeholder = "Search repository";
  input.setAttribute("aria-label", "Search repository");
  input.autocomplete = "off";
  const options = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Search options";
  options.append(
    legend,
    option(document, "fixed", "Fixed"),
    option(document, "hidden", "Hidden"),
    option(document, "ignored", "Ignored"),
    textOption(document, "glob", "Glob"),
    textOption(document, "type", "Type"),
    numberOption(document),
  );
  const status = document.createElement("p");
  status.setAttribute("aria-live", "polite");
  const list = document.createElement("ul");
  form.append(input, options, status, list);
  dialog.append(form);
  document.body.append(dialog);
  let selected = 0;
  let controller: AbortController | undefined;
  let timer: number | undefined;
  const clear = () => {
    clearTimeout(timer);
    controller?.abort();
    controller = undefined;
    selected = 0;
    list.replaceChildren();
    status.textContent = "Type to search";
  };
  const render = (values: SearchValue[]) => {
    list.replaceChildren(
      ...values.map((value, index) =>
        result(document, value, index === selected)
      ),
    );
    list.querySelector('[data-selected="true"]')?.scrollIntoView({
      block: "nearest",
    });
  };
  const load = async () => {
    const query = input.value.trim();
    if (!query) return clear();
    controller?.abort();
    const current = controller = new AbortController();
    status.textContent = "Searching…";
    try {
      const url = new URL("/__markdown_serve__/search", location.href);
      url.searchParams.set("path", scope);
      url.searchParams.set("search", query);
      url.searchParams.set("smartCase", "1");
      for (const control of options.querySelectorAll("input")) {
        if (control.type === "checkbox") {
          if (control.checked) url.searchParams.set(control.name, "1");
        } else if (control.value) {
          url.searchParams.set(control.name, control.value);
        }
      }
      const response = await fetch(url, { signal: current.signal });
      if (!response.ok) throw new Error("unavailable");
      const values = await response.json() as SearchValue[];
      if (controller !== current) return;
      selected = 0;
      render(values);
      status.textContent = values.length
        ? `${values.length} results`
        : "No results";
    } catch (error) {
      if (controller === current && (error as Error).name !== "AbortError") {
        list.replaceChildren();
        status.textContent = "Search unavailable";
      }
    } finally {
      if (controller === current) controller = undefined;
    }
  };
  const schedule = () => {
    clearTimeout(timer);
    controller?.abort();
    timer = setTimeout(load, 180) as unknown as number;
  };
  form.addEventListener("input", schedule);
  form.addEventListener("submit", (event) => event.preventDefault());
  dialog.addEventListener("keydown", (event) => {
    if (event.target !== input) return;
    const links = list.querySelectorAll("a");
    if (event.key === "Enter" && links[selected]) {
      event.preventDefault();
      location.assign(links[selected].href);
    } else if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") && links.length
    ) {
      event.preventDefault();
      selected =
        (selected + (event.key === "ArrowDown" ? 1 : -1) + links.length) %
        links.length;
      [...list.children].forEach((item, index) =>
        item.toggleAttribute("data-selected", index === selected)
      );
      links[selected].scrollIntoView({ block: "nearest" });
    }
  });
  installDialogDismissal(dialog, clear);
  return { dialog, input };
}

function option(
  document: ClientDocument,
  name: string,
  label: string,
): ClientElement {
  const result = document.createElement("label");
  const input = document.createElement("input");
  input.type = "checkbox";
  input.name = name;
  input.value = "1";
  result.append(input, ` ${label}`);
  return result;
}
function textOption(
  document: ClientDocument,
  name: string,
  label: string,
): ClientElement {
  const result = document.createElement("label");
  result.textContent = `${label} `;
  const input = document.createElement("input");
  input.type = "text";
  input.name = name;
  result.append(input);
  return result;
}
function numberOption(document: ClientDocument): ClientElement {
  const result = textOption(document, "context", "Context");
  const input = result.querySelector("input")!;
  input.type = "number";
  input.min = "0";
  input.max = "8";
  input.value = "0";
  return result;
}
type SearchValue = {
  path: string;
  line: number;
  text: string;
  context?: { line: number; text: string }[];
  href: string;
};
function result(
  document: ClientDocument,
  value: SearchValue,
  selected: boolean,
): ClientElement {
  const item = document.createElement("li");
  item.toggleAttribute("data-selected", selected);
  const link = document.createElement("a");
  link.href = value.href;
  link.textContent = `${value.path}:${value.line}  ${value.text}`;
  for (const line of value.context ?? []) {
    const context = document.createElement("span");
    context.dataset.context = "true";
    context.textContent = `${line.line}: ${line.text}`;
    link.append(context);
  }
  item.append(link);
  return item;
}

export const contentSearchClient =
  `${createSearch.toString()}${option.toString()}${textOption.toString()}${numberOption.toString()}${result.toString()}(${installContentSearch.toString()})(document, location, fetch, typeof pageSignal === 'undefined' ? undefined : pageSignal);`;

type ClientEvent = {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  target: ClientElement | null;
  preventDefault(): void;
};
type ClientElement = {
  autocomplete: string;
  checked: boolean;
  children: ClientElement[];
  className: string;
  dataset: Record<string, string>;
  href: string;
  max: string;
  min: string;
  name: string;
  placeholder: string;
  textContent: string;
  type: string;
  value: string;
  append(...children: (ClientElement | string)[]): void;
  addEventListener(type: string, listener: (event: ClientEvent) => void): void;
  close(): void;
  dispatchEvent(event: Event): boolean;
  focus(): void;
  querySelector(selector: string): ClientElement | null;
  querySelectorAll(selector: string): ClientElement[];
  replaceChildren(...children: ClientElement[]): void;
  scrollIntoView(options: { block: string }): void;
  setAttribute(name: string, value: string): void;
  showModal(): void;
  open: boolean;
  toggleAttribute(name: string, force?: boolean): boolean;
  closest(selector: string): ClientElement | null;
};
type ClientDocument = {
  body: ClientElement;
  createElement(name: string): ClientElement;
  addEventListener(
    type: string,
    listener: (event: ClientEvent) => void,
    options?: { signal: AbortSignal },
  ): void;
};
type ClientLocation = { href: string; assign(href: string): void };
type ClientFetch = (
  url: URL,
  options: { signal: AbortSignal },
) => Promise<{ ok: boolean; json(): Promise<unknown> }>;
