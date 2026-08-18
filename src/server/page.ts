import { breadcrumbs } from "./breadcrumb.ts";
import { escapeHtml } from "./html.ts";
import { navigationTree } from "./navigation-tree.ts";
import { pageClient } from "./page-client.ts";
import { pageCss } from "./page-css.ts";
import type { ServerConfig } from "./types.ts";

export async function page(
  config: ServerConfig,
  title: string,
  parts: string[],
  directory: boolean,
  content: string,
): Promise<string> {
  const reload = config.reloadSource
    ? `<script>new EventSource("/__markdown_server__/events").addEventListener("reload",()=>location.reload())</script>`
    : "";
  return `<!doctype html><html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${
    escapeHtml(title)
  }</title><style>${pageCss}</style></head><body><button class="browse" aria-controls="browse" aria-expanded="false">Browse</button><div class="layout"><aside id="browse" class="tree" data-open="false">${await navigationTree(
    config,
    parts,
  )}</aside><main class="content markdown-body">${
    breadcrumbs(parts, directory)
  }${content}</main></div><script>${pageClient}</script>${reload}</body></html>`;
}
