import { join } from "@std/path";
import { escapeHtml } from "./html.ts";
import { classifyEntry, entryRoute } from "./entry-route.ts";
import { entryKind } from "./entry-kind.ts";
import { compareDirectoriesFirst } from "./directory-order.ts";
import type { IndexState } from "./file-catalog.ts";
import type { DirectoryEntry } from "./fs.ts";
import { canonicalPath } from "./paths.ts";
import type { ServerConfig } from "./types.ts";
import {
  gitDirtyCount,
  gitDisplay,
  type GitStatus,
  gitStatusAt,
} from "./git/status.ts";

export async function navigationTree(
  config: ServerConfig,
  active: string[],
  directoryView: boolean,
  sourceName?: string,
  status?: GitStatus,
): Promise<string> {
  const rootClass = active.length === 0 && directoryView
    ? "tree-root active"
    : "tree-root";
  const rootLink = `<a class="${rootClass}" href="/" data-query-remove="dir">${
    escapeHtml(config.rootLabel)
  }</a>`;
  const rootFilesLink = filesLink(
    directoryFilesHref("/", config.catalog.indexState(config.rootPath)),
    config.rootLabel,
  );
  const context = status
    ? `<span class="tree-repo-context" title="${
      escapeHtml(repoTitle(status))
    }" aria-label="Git: ${escapeHtml(repoTitle(status))}">${
      escapeHtml(status.detached ? "detached" : status.branch ?? "Git")
    }${gitDirtyCount(status) ? ` <b>${gitDirtyCount(status)}</b>` : ""}</span>`
    : "";
  return `<nav aria-label="Files"><div class="tree-root-row">${rootLink}${context}${rootFilesLink}</div>${await treeList(
    config,
    [],
    active,
    directoryView,
    sourceName,
    status,
  )}</nav>`;
}

async function treeList(
  config: ServerConfig,
  parent: string[],
  active: string[],
  directoryView: boolean,
  sourceName: string | undefined,
  status: GitStatus | undefined,
): Promise<string> {
  const entries = await config.catalog.entries(
    join(config.rootPath, ...parent),
  );
  const children = await Promise.all(
    entries.toSorted(compareDirectoriesFirst).map(async (entry) => {
      const path = [...parent, entry.name];
      return await treeItem(
        config,
        entry,
        path,
        active,
        directoryView,
        sourceName,
        entry.directory && active[parent.length] === entry.name,
        status,
      );
    }),
  );
  return `<ul>${children.join("")}</ul>`;
}

async function treeItem(
  config: ServerConfig,
  entry: DirectoryEntry,
  path: string[],
  active: string[],
  directoryView: boolean,
  sourceName: string | undefined,
  activeDirectory: boolean,
  status: GitStatus | undefined,
): Promise<string> {
  const classification = classifyEntry(entry);
  const isIndex = classification.index;
  const resolved = entryRoute(path.slice(0, -1), entry);
  const route = resolved.parts;
  const href = canonicalPath(route, resolved.trailing);
  const activeItem = entry.directory
    ? directoryView && active.join("/") === route.join("/")
    : isIndex
    ? !directoryView && active.join("/") === route.join("/") &&
      sourceName === entry.name
    : active.join("/") === route.join("/");
  const linkClass = entry.directory
    ? `${activeItem ? "active " : ""}tree-folder-link`
    : activeItem
    ? "active"
    : undefined;
  const git = gitStatusAt(status, path.join("/"), entry.directory);
  const marker = git
    ? `<span class="git-marker" data-git-kind="${git.kind}" title="${
      escapeHtml(git.tooltip)
    }" aria-label="${escapeHtml(git.tooltip)}">${
      escapeHtml(gitDisplay(git))
    }</span>`
    : "";
  const link = `<a${linkClass ? ` class="${linkClass}"` : ""} data-kind="${
    entryKind(entry)
  }"${
    git?.kind === "ignored" ? ' data-git-ignored="true"' : ""
  } href="${href}"${
    entry.directory || isIndex ? ' data-query-remove="dir"' : ""
  }>${escapeHtml(entry.name)}${entry.directory ? "/" : ""}</a>${marker}`;
  if (!entry.directory) {
    const files = isIndex
      ? filesLink(
        `${href}?dir`,
        path.length === 1 ? config.rootLabel : path.at(-2)!,
      )
      : "";
    return files
      ? `<li class="tree-entry-row">${link}${files}</li>`
      : `<li>${link}</li>`;
  }
  const descendants = activeDirectory
    ? await treeList(config, path, active, directoryView, sourceName, status)
    : "<ul></ul>";
  const files = filesLink(
    directoryFilesHref(
      href,
      config.catalog.indexState(join(config.rootPath, ...path)),
    ),
    entry.name,
  );
  return `<li><details data-path="${escapeHtml(path.join("/"))}"${
    activeDirectory ? ' data-loaded="true" open' : ""
  }><summary>${link}${files}</summary>${descendants}</details></li>`;
}

function repoTitle(status: GitStatus): string {
  return [
    status.detached ? "Detached HEAD" : `Branch ${status.branch ?? "unknown"}`,
    status.ahead ? `${status.ahead} ahead` : "",
    status.behind ? `${status.behind} behind` : "",
    gitDirtyCount(status) ? `${gitDirtyCount(status)} changed` : "clean",
  ].filter(Boolean).join(", ");
}

function filesLink(href: string, name: string): string {
  const label = escapeHtml(name);
  return `<a class="tree-files-link" href="${href}" data-query-scope="directory" title="Show files in ${label}" aria-label="Show files in ${label}">Files</a>`;
}

function directoryFilesHref(href: string, indexState: IndexState): string {
  return indexState.known && !indexState.index ? href : `${href}?dir`;
}
