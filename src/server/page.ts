import { breadcrumbs } from "./breadcrumb.ts";
import { displayInitialClient } from "./display-controls-client.ts";
import { displayLinks } from "./display-links.ts";
import { escapeHtml } from "./html.ts";
import { navigationTree } from "./navigation-tree.ts";
import {
  renderFileMetadataDetails,
  renderFileMetadataSummary,
} from "./file-metadata.ts";
import type { PageAction } from "./page-action.ts";
import { pageScript, pageStylesheet } from "./page-assets.ts";
import type { PageModel } from "./page-model.ts";
import type { ServerConfig } from "./types.ts";

export async function page(
  config: ServerConfig,
  model: PageModel,
): Promise<string> {
  const navigation = await navigationTree(
    config,
    model.parts,
    model.directoryView ?? false,
    model.sourceName,
  );
  return `<!doctype html><html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" data-width="narrow" data-directory-view="${
    model.directoryView ? "true" : "false"
  }">${renderHead(model)}${renderBody(config, model, navigation)}</html>`;
}

function renderHead(model: PageModel): string {
  return `<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${
    escapeHtml(model.title)
  }</title><script>${displayInitialClient}</script><link rel="stylesheet" href="${pageStylesheet.url}"></head>`;
}

function renderBody(
  config: ServerConfig,
  model: PageModel,
  navigation: string,
): string {
  const metadataExpanded = model.url.searchParams.getAll("metadata").includes(
    "expand",
  );
  return `<body><div class="layout"><aside class="tree">${navigation}</aside><main class="content markdown-body">${
    renderContentHeader(config, model, metadataExpanded)
  }${
    model.metadata && metadataExpanded
      ? renderFileMetadataDetails(model.metadata)
      : ""
  }${model.content}</main></div><script src="${pageScript.url}"></script>${
    reloadClient(config)
  }</body>`;
}

function renderContentHeader(
  config: ServerConfig,
  model: PageModel,
  metadataExpanded: boolean,
): string {
  const breadcrumb = breadcrumbs(
    config.rootLabel,
    model.parts,
    model.directory,
    model.sourceName,
  );
  const actions = (model.actions ?? []).map(renderPageAction).join("");
  return `<header class="content-header">${breadcrumb}${actions}${
    model.metadata
      ? renderFileMetadataSummary(model.metadata, model.url, metadataExpanded)
      : ""
  }${displayLinks(model.url)}</header>`;
}

function reloadClient(config: ServerConfig): string {
  return config.reloadSource
    ? `<script>new EventSource("/__markdown_server__/events").addEventListener("reload",()=>location.reload())</script>`
    : "";
}

function renderPageAction(action: PageAction): string {
  const className = action.kind === "raw"
    ? "raw-link"
    : action.kind === "download"
    ? "page-action download-link"
    : "page-action";
  const queryRemove = action.kind === "index" ? action.queryRemove : undefined;
  const title = action.title;
  return `<a class="${className}" href="${escapeHtml(action.href)}"${
    queryRemove?.length
      ? ` data-query-remove="${escapeHtml(queryRemove.join(" "))}"`
      : ""
  } title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${
    escapeHtml(action.label)
  }</a>`;
}
