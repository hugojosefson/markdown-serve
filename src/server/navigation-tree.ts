import { join } from "@std/path";
import { directoryEntries } from "./fs.ts";
import { escapeHtml } from "./html.ts";
import { indexName } from "./indexes.ts";
import { canonicalPath } from "./paths.ts";
import type { ServerConfig } from "./types.ts";

export async function navigationTree(
  config: ServerConfig,
  active: string[],
  directoryView: boolean,
  sourceName?: string,
): Promise<string> {
  const rootClass = active.length === 0 && directoryView
    ? "tree-root active"
    : "tree-root";
  const rootLink = `<a class="${rootClass}" href="/" data-query-remove="dir">${
    escapeHtml(config.rootLabel)
  }</a>`;
  const rootFilesLink = await indexName(config.rootPath)
    ? filesLink("/?dir", config.rootLabel)
    : "";
  return `<nav aria-label="Files"><div class="tree-root-row">${rootLink}${rootFilesLink}</div>${await treeList(
    config,
    [],
    active,
    directoryView,
    sourceName,
  )}</nav>`;
}

async function treeList(
  config: ServerConfig,
  parent: string[],
  active: string[],
  directoryView: boolean,
  sourceName: string | undefined,
): Promise<string> {
  const entries = await directoryEntries(join(config.rootPath, ...parent));
  const children = await Promise.all(entries.map(async (entry) => {
    const path = [...parent, entry.name];
    return await treeItem(
      config,
      entry,
      path,
      active,
      directoryView,
      sourceName,
      entry.directory && active[parent.length] === entry.name,
    );
  }));
  return `<ul>${children.join("")}</ul>`;
}

async function treeItem(
  config: ServerConfig,
  entry: { name: string; directory: boolean },
  path: string[],
  active: string[],
  directoryView: boolean,
  sourceName: string | undefined,
  activeDirectory: boolean,
): Promise<string> {
  const markdown = entry.name.toLowerCase().endsWith(".md");
  const index = markdown && /^(readme|index)\.md$/i.test(entry.name);
  const route = index
    ? path.slice(0, -1)
    : markdown
    ? [...path.slice(0, -1), entry.name.slice(0, -3)]
    : path;
  const href = canonicalPath(route, entry.directory || index);
  const activeItem = entry.directory
    ? directoryView && active.join("/") === route.join("/")
    : index
    ? !directoryView && active.join("/") === route.join("/") &&
      sourceName === entry.name
    : active.join("/") === route.join("/");
  const linkClass = entry.directory
    ? `${activeItem ? "active " : ""}tree-folder-link`
    : activeItem
    ? "active"
    : undefined;
  const link = `<a${linkClass ? ` class="${linkClass}"` : ""} href="${href}"${
    entry.directory || index ? ' data-query-remove="dir"' : ""
  }>${escapeHtml(entry.name)}${entry.directory ? "/" : ""}</a>`;
  if (!entry.directory) {
    return `<li>${link}</li>`;
  }
  const descendants = activeDirectory
    ? await treeList(config, path, active, directoryView, sourceName)
    : "<ul></ul>";
  const files = await indexName(join(config.rootPath, ...path))
    ? filesLink(`${href}?dir`, entry.name)
    : "";
  return `<li><details data-path="${escapeHtml(path.join("/"))}"${
    activeDirectory ? ' data-loaded="true" open' : ""
  }><summary>${link}${files}</summary>${descendants}</details></li>`;
}

function filesLink(href: string, name: string): string {
  const label = escapeHtml(name);
  return `<a class="tree-files-link" href="${href}" title="Show files in ${label}" aria-label="Show files in ${label}">Files</a>`;
}
