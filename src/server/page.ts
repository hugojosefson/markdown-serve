import { breadcrumbs } from "./breadcrumb.ts";
import { codeToolbarClient } from "./code-toolbar-client.ts";
import {
  displayControlsClient,
  displayInitialClient,
} from "./display-controls-client.ts";
import { displayLinks } from "./display-links.ts";
import { escapeHtml } from "./html.ts";
import { navigationTree } from "./navigation-tree.ts";
import { pageClient } from "./page-client.ts";
import { pageCss } from "./page-css.ts";
import type { ServerConfig } from "./types.ts";

export type PageAction = {
  href: string;
  label: string;
  title?: string;
  kind: "files" | "index" | "raw";
};

export async function page(
  config: ServerConfig,
  title: string,
  parts: string[],
  directory: boolean,
  content: string,
  url: URL,
  actions: PageAction[] = [],
  indexName?: string,
): Promise<string> {
  const reload = config.reloadSource
    ? `<script>new EventSource("/__markdown_server__/events").addEventListener("reload",()=>location.reload())</script>`
    : "";
  return `<!doctype html><html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" data-width="narrow"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${
    escapeHtml(title)
  }</title><script>${displayInitialClient}</script><style>${pageCss}</style></head><body><a class="browse" href="#browse">Browse</a><div class="layout"><aside id="browse" class="tree">${await navigationTree(
    config,
    parts,
  )}</aside><main class="content markdown-body"><header class="content-header">${
    breadcrumbs(config.rootLabel, parts, directory, indexName)
  }${actions.map(renderPageAction).join("")}${
    displayLinks(url)
  }</header>${content}</main></div><script>${displayControlsClient}${pageClient}${codeToolbarClient}</script>${reload}</body></html>`;
}

function renderPageAction(action: PageAction): string {
  const className = action.kind === "raw" ? "raw-link" : "page-action";
  return `<a class="${className}" href="${escapeHtml(action.href)}"${
    action.title ? ` title="${escapeHtml(action.title)}"` : ""
  }>${escapeHtml(action.label)}</a>`;
}
