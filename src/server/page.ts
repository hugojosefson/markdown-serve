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
import { reloadClientScript } from "./reload-client.ts";
import type { ServerConfig } from "./types.ts";
import { gitDirtyCount, type GitStatus } from "./git/status.ts";

export async function page(
  config: ServerConfig,
  model: PageModel,
): Promise<string> {
  const status = model.gitStatus ?? await config.git?.status();
  const navigation = await navigationTree(
    config,
    model.parts,
    model.directoryView ?? false,
    model.sourceName,
    status,
  );
  return `<!doctype html><html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark" data-width="narrow" data-directory-view="${
    model.directoryView ? "true" : "false"
  }">${renderHead(model)}${
    renderBody(config, model, navigation, status)
  }</html>`;
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
  status?: GitStatus,
): string {
  const metadataExpanded = model.url.searchParams.getAll("metadata").includes(
    "expand",
  );
  return `<body><div class="layout"><aside class="tree">${navigation}</aside><main class="content markdown-body">${
    repoContext(status)
  }${renderContentHeader(config, model, metadataExpanded)}${
    model.metadata && metadataExpanded
      ? renderFileMetadataDetails(model.metadata, model.url)
      : ""
  }${
    renderPageContent(model)
  }</main></div><script src="${pageScript.url}"></script>${
    reloadClient(config)
  }</body>`;
}

function repoContext(status?: GitStatus): string {
  if (!status) return "";
  const details = [
    status.detached ? "detached HEAD" : status.branch ?? "unknown branch",
    status.ahead ? `${status.ahead} ahead` : "",
    status.behind ? `${status.behind} behind` : "",
    gitDirtyCount(status) ? `${gitDirtyCount(status)} changed` : "clean",
  ].filter(Boolean).join(", ");
  return `<div class="repo-context" title="${
    escapeHtml(details)
  }" aria-label="Git: ${escapeHtml(details)}">${
    escapeHtml(status.detached ? "detached" : status.branch ?? "Git")
  }<span aria-hidden="true"> · </span>${
    escapeHtml(
      gitDirtyCount(status) ? `${gitDirtyCount(status)} dirty` : "clean",
    )
  }</div>`;
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
  const actions = (model.actions ?? []).map((action) =>
    renderPageAction(action)
  )
    .join("");
  return `<header class="content-header${
    model.metadata && metadataExpanded ? " metadata-expanded" : ""
  }">${breadcrumb}${actions}${
    model.metadata
      ? renderFileMetadataSummary(model.metadata, model.url, metadataExpanded)
      : ""
  }${displayLinks(model.url)}</header>`;
}

function renderPageContent(model: PageModel): string {
  if (!model.contentAction) {
    return model.content;
  }
  const view = model.contentAction.kind === "rendered" ? "source" : "rendered";
  return `<div class="page-content page-content-${view}"><div class="content-view-control">${
    renderPageAction(model.contentAction, "content-view-action")
  }</div>${model.content}</div>`;
}

function reloadClient(config: ServerConfig): string {
  return config.reloadSource ? `<script>${reloadClientScript}</script>` : "";
}

function renderPageAction(action: PageAction, classOverride?: string): string {
  const className = classOverride ??
    (action.kind === "raw"
      ? "raw-link"
      : action.kind === "download"
      ? "page-action download-link"
      : "page-action");
  const queryRemove = "queryRemove" in action ? action.queryRemove : undefined;
  const title = action.title;
  return `<a class="${className}" href="${escapeHtml(action.href)}"${
    queryRemove?.length
      ? ` data-query-remove="${escapeHtml(queryRemove.join(" "))}"`
      : ""
  } title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${
    escapeHtml(action.label)
  }</a>`;
}
