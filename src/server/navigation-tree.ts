import { join } from "@std/path";
import { directoryEntries } from "./fs.ts";
import { escapeHtml } from "./html.ts";
import { canonicalPath } from "./paths.ts";
import type { ServerConfig } from "./types.ts";

export async function navigationTree(
  config: ServerConfig,
  active: string[],
): Promise<string> {
  const rootClass = active.length === 0 ? "tree-root active" : "tree-root";
  return `<nav aria-label="Files"><a href="/" class="tree-heading">Files</a><a class="${rootClass}" href="/">${
    escapeHtml(config.rootLabel)
  }</a>${await treeList(
    config,
    [],
    active,
  )}</nav>`;
}

async function treeList(
  config: ServerConfig,
  parent: string[],
  active: string[],
): Promise<string> {
  const entries = await directoryEntries(join(config.rootPath, ...parent));
  const children = await Promise.all(entries.map(async (entry) => {
    const path = [...parent, entry.name];
    return await treeItem(
      config,
      entry,
      path,
      active,
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
  const activeItem = activeDirectory ||
    (!entry.directory && active.join("/") === route.join("/"));
  const link = `<a${activeItem ? ' class="active"' : ""} href="${href}">${
    escapeHtml(entry.name)
  }${entry.directory ? "/" : ""}</a>`;
  if (!entry.directory) {
    return `<li>${link}</li>`;
  }
  const descendants = activeDirectory
    ? await treeList(config, path, active)
    : "<ul></ul>";
  return `<li><details data-path="${escapeHtml(path.join("/"))}"${
    activeDirectory ? ' data-loaded="true" open' : ""
  }><summary>${link}</summary>${descendants}</details></li>`;
}
