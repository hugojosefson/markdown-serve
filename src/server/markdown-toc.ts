type Heading = {
  level: number;
  idHtml: string;
  labelHtml: string;
  index: number;
  end: number;
};

export function renderMarkdownToc(html: string): string {
  const headings = headingsFromHtml(html);
  if (!headings.length) return html;
  const initiallyOpen = headings.length > initialHeadingCount(html, headings);
  return `<details class="markdown-toc"${
    initiallyOpen ? " open" : ""
  }><summary>Contents</summary><nav aria-label="Table of contents"><ol>${
    headings.map((heading) =>
      `<li class="markdown-toc-level-${heading.level}"><a href="#${heading.idHtml}">${heading.labelHtml}</a></li>`
    ).join("")
  }</ol></nav></details>${html}`;
}

function headingsFromHtml(html: string): Heading[] {
  const headings: Heading[] = [];
  const expression = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  for (const match of html.matchAll(expression)) {
    const id = /\bid="([^"]*)"/.exec(match[2])?.[1];
    if (id === undefined) continue;
    headings.push({
      level: Number(match[1]),
      idHtml: id,
      labelHtml: readableTextHtml(match[3]),
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return headings;
}

function initialHeadingCount(html: string, headings: Heading[]): number {
  let end = 0;
  let count = 0;
  for (const heading of headings) {
    if (html.slice(end, heading.index).trim()) break;
    end = heading.end;
    count++;
  }
  return count;
}

function readableTextHtml(html: string): string {
  // GFM has already sanitized and escaped this HTML. Preserve entities so
  // numeric and named references display exactly as they do in the heading.
  return html
    .replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
