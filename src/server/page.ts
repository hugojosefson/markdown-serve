import { breadcrumbs } from "./breadcrumb.ts";
import { codeToolbarClient } from "./code-toolbar-client.ts";
import {
  displayControlsClient,
  displayInitialClient,
} from "./display-controls-client.ts";
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
  rawHref?: string,
): Promise<string> {
  const reload = config.reloadSource
    ? `<script>new EventSource("/__markdown_server__/events").addEventListener("reload",()=>location.reload())</script>`
    : "";
  return `<!doctype html><html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" data-width="auto"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${
    escapeHtml(title)
  }</title><script>${displayInitialClient}</script><style>${pageCss}</style></head><body><div class="page-toolbar"><button class="browse" aria-controls="browse" aria-expanded="false">Browse</button><fieldset class="display-controls"><legend>Display</legend><label>Theme <select name="theme" aria-label="Theme"><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Width <select name="width" aria-label="Width" aria-keyshortcuts="w"><option value="auto">Auto</option><option value="wide">Wide</option></select></label></fieldset></div><div class="layout"><aside id="browse" class="tree" data-open="false">${await navigationTree(
    config,
    parts,
  )}</aside><main class="content markdown-body">${
    breadcrumbs(parts, directory)
  }${
    rawHref ? `<a class="raw-link" href="${escapeHtml(rawHref)}">Raw</a>` : ""
  }${content}</main></div><script>${displayControlsClient}${pageClient}${codeToolbarClient}</script>${reload}</body></html>`;
}
