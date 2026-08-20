import type { SourceLineAnnotation } from "./git/diff.ts";
import { escapeHtml } from "./html.ts";
import type { SymbolDeclarationLink } from "./symbols/types.ts";

/** Adds source-file line links without changing the highlighted code text. */
export function renderSourceLines(
  highlighted: string,
  annotations: ReadonlyMap<number, SourceLineAnnotation> = new Map(),
  declarations: ReadonlySet<number> = new Set(),
  declarationLinks: ReadonlyMap<number, SymbolDeclarationLink> = new Map(),
): string {
  let line = 1;
  const symbolGutter = declarations.size > 0;
  const activeTags: string[] = [];
  const openLine = () => {
    const annotation = annotations.get(line);
    const change = annotation?.staged && annotation?.unstaged
      ? "both"
      : annotation?.staged
      ? "staged"
      : annotation?.unstaged
      ? "unstaged"
      : undefined;
    const deletionLabel = annotation?.deletions
      ? `${annotation.deletions} deleted line${
        annotation.deletions === 1 ? "" : "s"
      }`
      : "";
    const changeLabel = change === "both"
      ? "staged and unstaged change"
      : change
      ? `${change} change`
      : "";
    const lineLabel = [
      `Line ${line}`,
      changeLabel,
      deletionLabel,
    ].filter(Boolean).join(", ");
    const deletion = deletionLabel
      ? `<span class="source-line-deletions" data-deletions="${annotation?.deletions}" aria-hidden="true"></span>`
      : "";
    const declaration = declarationLinks.get(line);
    const symbol = declaration
      ? `<a class="source-symbol-marker" href="${
        escapeHtml(declaration.href)
      }" aria-label="Go to ${
        escapeHtml(declaration.name)
      } declaration on line ${line}"></a>`
      : symbolGutter
      ? '<span class="source-symbol-marker" aria-hidden="true"></span>'
      : "";
    return `<span class="source-line${
      symbolGutter ? " source-symbol-gutter" : ""
    }${declarations.has(line) ? " source-line-symbol" : ""}${
      change ? ` source-line-${change}` : ""
    }" id="L${line}"${
      change ? ` data-git-change="${change}"` : ""
    }><a class="source-line-number" href="#L${line}" aria-label="${lineLabel}" data-line="${line}">${deletion}</a>${symbol}<span class="source-line-content">`;
  };
  const closeTags = () => activeTags.toReversed().map(closeTag).join("");
  const reopenTags = () => activeTags.join("");
  const parts = highlighted.split(/(<[^>]+>)/);
  let result = openLine();

  for (const part of parts) {
    if (part.startsWith("<")) {
      result += part;
      updateActiveTags(part, activeTags);
      continue;
    }
    const lines = part.split("\n");
    for (let index = 0; index < lines.length; index++) {
      result += lines[index];
      if (index < lines.length - 1) {
        result +=
          `${closeTags()}</span></span><span class="source-line-break" aria-hidden="true">\n</span>`;
        line++;
        result += `${openLine()}${reopenTags()}`;
      }
    }
  }
  return `${result}${closeTags()}</span></span>`;
}

function closeTag(tag: string): string {
  const name = tag.match(/^<([^\s/>]+)/)?.[1];
  return name ? `</${name}>` : "";
}

function updateActiveTags(tag: string, activeTags: string[]): void {
  if (tag.startsWith("</")) {
    activeTags.pop();
    return;
  }
  if (!tag.endsWith("/>") && !tag.startsWith("<!")) {
    activeTags.push(tag);
  }
}
