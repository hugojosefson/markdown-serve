import { escapeHtml } from "./html.ts";
import { canonicalPath } from "./paths.ts";

export function breadcrumbs(parts: string[], directory: boolean): string {
  const links = parts.map((part, index) => {
    const last = index === parts.length - 1;
    const href = canonicalPath(parts.slice(0, index + 1), !last || directory);
    return `<a href="${href}">${escapeHtml(part)}</a>`;
  });
  return `<nav aria-label="Breadcrumb"><a href="/">Home</a>${
    links.length ? ` / ${links.join(" / ")}` : ""
  }</nav>`;
}
