import type { DirectoryEntry } from "./fs.ts";
import { escapeHtml } from "./html.ts";
import { queryHref, setQuery } from "./query.ts";
import { classifyEntry, entryRoute } from "./entry-route.ts";
import { formatSize, permissions } from "./file-metadata.ts";
import { renderIsoTimestamp } from "./render-iso-timestamp.ts";

type DirectoryOrder =
  | "name"
  | "name-desc"
  | "permissions"
  | "permissions-desc"
  | "size"
  | "size-desc"
  | "user"
  | "user-desc"
  | "modified"
  | "modified-desc";

export function directoryIndex(
  entries: DirectoryEntry[],
  url: URL,
  path: string,
): string {
  const order = directoryOrder(url.searchParams.get("order"));
  const rows = entries.toSorted(compareEntries(order)).map((entry) =>
    row(entry, url)
  ).join("");
  return `<div class="directory-scroll"><table class="directory-table"><caption class="sr-only">Files at ${
    escapeHtml(path)
  }</caption><thead><tr>${header(url, "Name", "name", order)}${
    header(url, "Permissions", "permissions", order)
  }${header(url, "Size", "size", order)}${header(url, "User", "user", order)}${
    header(url, "Modified", "modified", order)
  }</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function directoryOrder(value: string | null): DirectoryOrder {
  const orders: DirectoryOrder[] = [
    "name",
    "name-desc",
    "permissions",
    "permissions-desc",
    "size",
    "size-desc",
    "user",
    "user-desc",
    "modified",
    "modified-desc",
  ];
  return orders.includes(value as DirectoryOrder)
    ? value as DirectoryOrder
    : "name";
}

function compareEntries(order: DirectoryOrder) {
  const descending = order.endsWith("-desc");
  const field = order.replace("-desc", "") as DirectoryField;
  return (left: DirectoryEntry, right: DirectoryEntry): number => {
    const [leftValue, rightValue] = [value(left, field), value(right, field)];
    if ((leftValue === undefined) !== (rightValue === undefined)) {
      return leftValue === undefined ? -1 : 1;
    }
    const compared =
      typeof leftValue === "number" && typeof rightValue === "number"
        ? leftValue - rightValue
        : lexical(String(leftValue), String(rightValue));
    return (descending ? -compared : compared) ||
      lexical(left.name, right.name);
  };
}

function row(entry: DirectoryEntry, url: URL): string {
  const suffix = entry.directory ? "/" : "";
  const index = classifyEntry(entry).index;
  const route = entryRoute([], entry);
  const href = index
    ? url.pathname
    : encodeURIComponent(route.parts.at(-1)!) + suffix +
      (entry.directory ? "?dir" : "");
  const bytes = size(entry);
  const modified = modifiedTime(entry.info);
  return `<tr><td class="directory-name"><a href="${escapeHtml(href)}"${
    index ? ' data-query-remove="dir"' : ""
  }>${
    escapeHtml(entry.name + suffix)
  }</a></td><td class="directory-permissions">${
    permissions(entry.info) ?? "??????????"
  }</td><td class="directory-size"${
    bytes === undefined ? "" : ` title="${bytes} byte${bytes === 1 ? "" : "s"}"`
  }>${
    bytes === undefined ? "—" : formatSize(bytes)
  }</td><td class="directory-user">${
    user(entry.info) ?? "—"
  }</td><td class="directory-modified">${
    modified === undefined ? "—" : renderIsoTimestamp(new Date(modified))
  }</td></tr>`;
}

function size(entry: DirectoryEntry): number | undefined {
  return entry.directory || !entry.info ? undefined : entry.info.size;
}

function user(info: Deno.FileInfo | undefined): number | undefined {
  return info?.uid ?? undefined;
}

function modifiedTime(info: Deno.FileInfo | undefined): number | undefined {
  return info?.mtime?.getTime();
}

function value(
  entry: DirectoryEntry,
  field: DirectoryField,
): string | number | undefined {
  switch (field) {
    case "name":
      return entry.name;
    case "permissions":
      return permissions(entry.info);
    case "size":
      return size(entry);
    case "user":
      return user(entry.info);
    case "modified":
      return modifiedTime(entry.info);
  }
}

function header(
  url: URL,
  label: string,
  field: DirectoryField,
  active: DirectoryOrder,
): string {
  const current = active.replace("-desc", "") === field;
  const descending = active === `${field}-desc`;
  const next = current && !descending ? `${field}-desc` : field;
  const href = queryHref(
    url.pathname,
    setQuery(url.search, "order", next === "name" ? undefined : next),
  );
  return `<th class="directory-${field}" scope="col"${
    current ? ` aria-sort="${descending ? "descending" : "ascending"}"` : ""
  }><a href="${escapeHtml(href)}">${label}${
    current ? ` ${descending ? "↓" : "↑"}` : ""
  }</a></th>`;
}

type DirectoryField = "name" | "permissions" | "size" | "user" | "modified";

function lexical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
