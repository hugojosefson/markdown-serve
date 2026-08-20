import { escapeHtml } from "./html.ts";
import { canonicalPath } from "./paths.ts";

export function breadcrumbs(
  rootLabel: string,
  parts: string[],
  directory: boolean,
  sourceName?: string,
): string {
  const crumbs = sourceName
    ? directory ? [...parts, sourceName] : [...parts.slice(0, -1), sourceName]
    : parts;
  const root = breadcrumbRoot(rootLabel, crumbs.length > 0);
  const links = crumbs.map((part, index) => {
    const last = index === crumbs.length - 1;
    const href = directoryHref(
      canonicalPath(crumbs.slice(0, index + 1), !last || directory),
    );
    return last
      ? `<span aria-current="page">${escapeHtml(part)}${
        directory && !sourceName ? "/" : ""
      }</span>`
      : `<a href="${href}">${escapeHtml(part)}</a>`;
  });
  const rootCrumb = crumbs.length
    ? `<a href="/?dir">${escapeHtml(root)}</a>`
    : `<span aria-current="page">${escapeHtml(root)}</span>`;
  return `<nav aria-label="Breadcrumb">${rootCrumb}${
    links.map((link, index) =>
      `<span class="breadcrumb-separator" aria-hidden="true">${
        index || !root.endsWith("/") ? "/" : ""
      }</span>${link}`
    ).join("")
  }</nav>`;
}

function directoryHref(path: string): string {
  return `${path}?dir`;
}

export function breadcrumbPath(root: string, parts: string[]): string {
  const cleanRoot = breadcrumbRoot(root, parts.length > 0);
  if (!parts.length) {
    return cleanRoot || "/";
  }
  return `${cleanRoot === "/" ? cleanRoot : `${cleanRoot}/`}${
    parts.join("/")
  }/`;
}

function breadcrumbRoot(root: string, hasParts: boolean): string {
  return hasParts && root !== "/" ? root.replace(/\/+$/, "") : root;
}
