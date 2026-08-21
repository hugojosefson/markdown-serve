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
    for (
      const piece of part.match(
        /&(?:#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);|[\s\S]/gi,
      ) ?? []
    ) {
      const start = starts.get(offset);
      if (start) {
        output += `<a class="${
          start.kind === "heading" ? "source-heading-link" : "symbol-link"
        }${
          start.declaration
            ? start.kind === "heading"
              ? " source-heading-declaration"
              : " symbol-declaration"
            : ""
        }" href="${escapeHtml(start.href)}"${
          start.id ? ` id="${escapeHtml(start.id)}"` : ""
        }${
          start.commentLines
            ? ` style="--attached-comment-lines:${start.commentLines}"`
            : ""
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
  const hexadecimal = value.match(/^&#x([\da-f]+);$/i)?.[1];
  if (hexadecimal) {
    return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
  }
  const decimal = value.match(/^&#(\d+);$/)?.[1];
  if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
  return ({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
    "&#39;": "'",
  } as Record<string, string>)[value] ?? value;
}
