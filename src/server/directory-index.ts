import type { DirectoryEntry } from "./fs.ts";
import { escapeHtml } from "./html.ts";
import { queryHref, setQuery } from "./query.ts";
import { classifyEntry, entryRoute } from "./entry-route.ts";
import { entryKind } from "./entry-kind.ts";
import { formatSize, permissions } from "./file-metadata.ts";
import { gitDisplay, type GitStatus, gitStatusAt } from "./git/status.ts";
import { renderIsoTimestamp } from "./render-iso-timestamp.ts";

type DirectoryField =
  | "name"
  | "git"
  | "permissions"
  | "size"
  | "user"
  | "modified";
type DirectoryOrder = DirectoryField | `${DirectoryField}-desc`;

export function directoryIndex(
  entries: DirectoryEntry[],
  url: URL,
  path: string,
  status?: GitStatus,
  gitPrefix = "",
): string {
  const order = directoryOrder(url.searchParams.get("order"));
  const rows = entries.toSorted(compareEntries(order, status, gitPrefix)).map(
    (entry) => row(entry, url, status, gitPrefix),
  ).join("");
  return `<div class="directory-scroll"><table class="directory-table"><caption class="sr-only">Files at ${
    escapeHtml(path)
  }</caption><thead><tr>${header(url, "Name", "name", order)}${
    status ? header(url, "Git", "git", order) : ""
  }${header(url, "Permissions", "permissions", order)}${
    header(url, "Size", "size", order)
  }${header(url, "User", "user", order)}${
    header(url, "Modified", "modified", order)
  }</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function directoryOrder(value: string | null): DirectoryOrder {
  const fields: DirectoryField[] = [
    "name",
    "git",
    "permissions",
    "size",
    "user",
    "modified",
  ];
  return fields.flatMap((field) => [field, `${field}-desc`]).includes(
      value ?? "",
    )
    ? value as DirectoryOrder
    : "name";
}
function compareEntries(
  order: DirectoryOrder,
  status?: GitStatus,
  gitPrefix = "",
) {
  const descending = order.endsWith("-desc");
  const field = order.replace("-desc", "") as DirectoryField;
  return (left: DirectoryEntry, right: DirectoryEntry) => {
    const leftValue = value(left, field, status, gitPrefix);
    const rightValue = value(right, field, status, gitPrefix);
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
function row(
  entry: DirectoryEntry,
  url: URL,
  status?: GitStatus,
  gitPrefix = "",
): string {
  const suffix = entry.directory ? "/" : "";
  const index = classifyEntry(entry).index;
  const route = entryRoute([], entry);
  const href = index
    ? url.pathname
    : encodeURIComponent(route.parts.at(-1)!) + suffix +
      (entry.directory ? "?dir" : "");
  const bytes = size(entry);
  const modified = modifiedTime(entry.info);
  const git = gitStatusAt(
    status,
    gitPath(gitPrefix, entry.name),
    entry.directory,
  );
  const display = gitDisplay(git);
  return `<tr><td class="directory-name"><a href="${
    escapeHtml(href)
  }" data-kind="${entryKind(entry)}"${
    git?.kind === "ignored" ? ' data-git-ignored="true"' : ""
  }${index ? ' data-query-remove="dir"' : ""}>${
    escapeHtml(entry.name + suffix)
  }</a></td>${
    status
      ? `<td class="directory-git"><span data-git-kind="${
        git?.kind ?? ""
      }" title="${escapeHtml(git?.tooltip ?? "No Git status")}" aria-label="${
        escapeHtml(git?.tooltip ?? "No Git status")
      }">${escapeHtml(display || "—")}</span></td>`
      : ""
  }<td class="directory-permissions">${
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
function size(entry: DirectoryEntry) {
  return entry.directory || !entry.info ? undefined : entry.info.size;
}
function user(info: Deno.FileInfo | undefined) {
  return info?.uid ?? undefined;
}
function modifiedTime(info: Deno.FileInfo | undefined) {
  return info?.mtime?.getTime();
}
function value(
  entry: DirectoryEntry,
  field: DirectoryField,
  status?: GitStatus,
  gitPrefix = "",
): string | number | undefined {
  switch (field) {
    case "name":
      return entry.name;
    case "git":
      return gitDisplay(
        gitStatusAt(status, gitPath(gitPrefix, entry.name), entry.directory),
      );
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
function gitPath(prefix: string, name: string): string {
  return prefix ? `${prefix}/${name}` : name;
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
function lexical(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}
