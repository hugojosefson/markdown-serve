/** Adds source-file line links without changing the highlighted code text. */
export function renderSourceLines(highlighted: string): string {
  let line = 1;
  const activeTags: string[] = [];
  const openLine = () =>
    `<span class="source-line" id="L${line}"><a class="source-line-number" href="#L${line}" aria-label="Line ${line}" data-line="${line}"></a><span class="source-line-content">`;
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
        result += `${closeTags()}</span></span>\n`;
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
