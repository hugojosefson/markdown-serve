import { type Marked, Renderer } from "@deno/gfm";

export class MarkdownHeadingRenderer extends Renderer {
  readonly #ids = new Set<string>();
  readonly #fragments = new Map<string, string>();

  override heading(token: Marked.Tokens.Heading): string {
    const html = super.heading(token);
    const original = html.match(/^<h[1-6] id="([^"]*)">/)![1];
    const base = original.normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .replace(
        /\P{ASCII}/gu,
        (character) => `u${character.codePointAt(0)!.toString(16)}`,
      )
      .replace(/[^a-z0-9_-]/g, "") || "section";
    const id = this.uniqueId(base);
    this.#fragments.set(original, id);
    return html.replace(`id="${original}"`, `id="${id}"`);
  }

  rewriteInternalLinks(html: string): string {
    return html.replace(
      /<a\b[^>]*>/g,
      (tag) =>
        tag.replace(/\bhref="#([^"]*)"/, (attribute, fragment: string) => {
          const id = this.#fragments.get(decodedFragment(fragment));
          return id === undefined ? attribute : `href="#${id}"`;
        }),
    );
  }

  private uniqueId(base: string): string {
    let id = base;
    let suffix = 0;
    while (this.#ids.has(id)) {
      id = `${base}-${++suffix}`;
    }
    this.#ids.add(id);
    return id;
  }
}

function decodedFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}
