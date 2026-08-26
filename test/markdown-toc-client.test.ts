import { assertEquals, assertMatch } from "@std/assert";
import { markdownTocClient } from "../src/server/markdown-toc-client.ts";
import { pageScript, pageStylesheet } from "../src/server/page-assets.ts";

Deno.test("Markdown ToC client tracks fragment headings and current links", () => {
  const listeners = new Map<string, () => void>();
  const location = { hash: "#port-selection", href: "http://x/" };
  const classList = () => {
    const values = new Set<string>();
    return {
      add: (value: string) => values.add(value),
      remove: (value: string) => values.delete(value),
      toggle: (value: string, active: boolean) =>
        active ? values.add(value) : values.delete(value),
      values,
    };
  };
  const link = (href: string) => {
    const attributes = new Map<string, string>([["href", href]]);
    return {
      classList: classList(),
      getAttribute: (name: string) => attributes.get(name) ?? null,
      removeAttribute: (name: string) => attributes.delete(name),
      setAttribute: (name: string, value: string) =>
        attributes.set(name, value),
      attributes,
    };
  };
  const port = link("#port-selection");
  const special = link("#port%20%26%20selection");
  const toc = { querySelectorAll: () => [port, special] };
  const document = {
    querySelector: () => toc,
  };
  new Function("location", "document", "addEventListener", markdownTocClient)(
    location,
    document,
    (name: string, listener: () => void) => listeners.set(name, listener),
  );
  assertEquals(port.attributes.get("aria-current"), "location");
  assertEquals(port.classList.values.has("is-current"), true);
  location.hash = "#port%20%26%20selection";
  listeners.get("hashchange")?.();
  assertEquals(port.attributes.has("aria-current"), false);
  assertEquals(port.classList.values.has("is-current"), false);
  assertEquals(special.attributes.get("aria-current"), "location");
  assertEquals(special.classList.values.has("is-current"), true);
});

Deno.test("Markdown ToC fragment styles mark headings and current locations", () => {
  assertMatch(pageScript.body, /syncMarkdownTocLocation\(\);/);
  assertMatch(
    pageStylesheet.body,
    /\.markdown-toc a\.is-current \{[^}]*background: var\(--tree-active\);[^}]*color: #fff;/,
  );
  assertMatch(
    pageStylesheet.body,
    /\.markdown-body :is\(h1, h2, h3, h4, h5, h6\):target \{[^}]*background: var\(--code-hover\);[^}]*outline: 2px solid var\(--focus-color\);/,
  );
});

Deno.test("Markdown ToC client leaves source pages without a ToC untouched", () => {
  let queried = 0;
  new Function("location", "document", "addEventListener", markdownTocClient)(
    { hash: "#port-selection", href: "http://x/?source" },
    {
      querySelector: () => {
        queried++;
        return null;
      },
    },
    () => {},
  );
  assertEquals(queried, 1);
});
