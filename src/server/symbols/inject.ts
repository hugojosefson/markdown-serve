import { escapeHtml } from "../html.ts";
import type { SymbolOccurrence } from "./types.ts";

/** Inserts navigation markup while retaining Prism's escaped highlighted text. */
export function injectSymbols(
  highlighted: string,
  occurrences: readonly SymbolOccurrence[],
): string {
  const starts = new Map(occurrences.map((item) => [item.start, item]));
  const ends = new Map(occurrences.map((item) => [item.end, item]));
  let offset = 0;
  return highlighted.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith("<")) return part;
    let output = "";
    for (const piece of part.match(/&(?:amp|lt|gt|quot|#39);|[\s\S]/g) ?? []) {
      const start = starts.get(offset);
      if (start) {
        output += `<a class="symbol-link${
          start.declaration ? " symbol-declaration" : ""
        }" href="${escapeHtml(start.href)}"${
          start.id ? ` id="${escapeHtml(start.id)}"` : ""
        }>`;
      }
      output += piece;
      offset += decode(piece).length;
      if (ends.has(offset)) output += "</a>";
    }
    return output;
  }).join("");
}

function decode(value: string): string {
  return ({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
  } as Record<string, string>)[value] ?? value;
}
