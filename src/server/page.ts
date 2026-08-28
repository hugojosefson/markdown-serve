import { breadcrumbs } from "./breadcrumb.ts";
import { displayInitialClient } from "./display-controls-client.ts";
import { displayLinks } from "./display-links.ts";
import { escapeHtml } from "./html.ts";
import { navigationTree } from "./navigation-tree.ts";
import { navigationSpeculation } from "./navigation-speculation.ts";
import {
  renderFileMetadataDetails,
  renderFileMetadataSummary,
} from "./file-metadata.ts";
import type { FileAction, HeaderAction } from "./page-action.ts";
import { pageScript, pageStylesheet } from "./page-assets.ts";
import type { PageModel } from "./page-model.ts";
import { reloadClientScript } from "./reload-client.ts";
import type { ServerConfig } from "./types.ts";
import { gitDirtyCount, type GitStatus } from "./git/status.ts";
import { markdownViewHref } from "./page-action.ts";

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
  }</title><script>${displayInitialClient}</script>${navigationSpeculation}<link rel="stylesheet" href="${pageStylesheet.url}"></head>`;
}

function renderBody(
  config: ServerConfig,
  model: PageModel,
  navigation: string,
  status?: GitStatus,
): string {
  const metadataExpanded = model.markdownView === "edit" || model.editView
    ? false
    : model.url.searchParams.has("metadata");
  const scope = model.directory ? model.parts : model.parts.slice(0, -1);
  return `<body data-go-to-file-scope="${
    escapeHtml(scope.join("/"))
  }" data-content-search-scope="${
    escapeHtml(scope.join("/"))
  }"><div class="layout"><aside class="tree"><details class="tree-disclosure" open><summary>Files</summary>${navigation}</details></aside><main class="content markdown-body">${
    repoContext(status)
  }${renderContentHeader(config, model, metadataExpanded)}${
    model.metadata && metadataExpanded
      ? renderFileMetadataDetails(model.metadata, model.url)
      : ""
  }${
    model.markdownView === "source"
      ? renderSourcePanel(model)
      : model.markdownView === "edit" || model.editView
      ? renderEditPage(model)
      : renderPageContent(model)
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
  const actions = (model.headerActions ?? []).map((action) =>
    renderPageAction(action)
  )
    .join("");
  return `<header class="content-header${
    model.metadata && metadataExpanded ? " metadata-expanded" : ""
  }">${breadcrumb}${actions}<div class="content-controls">${
    model.markdownView === undefined
      ? model.editPath
        ? renderTextViewToggle(model.url, Boolean(model.editView))
        : ""
      : renderMarkdownViewToggle(
        model.url,
        model.markdownView,
        Boolean(model.editPath),
      )
  }${
    model.markdownView === undefined
      ? ""
      : `<div class="file-actions">${
        renderFileActions(
          model.fileActions?.filter((action) =>
            action.kind === "raw" || action.kind === "download"
          ) ?? [],
        )
      }</div>`
  }${
    model.metadata
      ? renderFileMetadataSummary(model.metadata, model.url, metadataExpanded)
      : ""
  }${displayLinks(model.url, model.directoryView ?? false)}</div></header>`;
}

function renderMarkdownViewToggle(
  url: URL,
  view: "rendered" | "source" | "edit",
  editable: boolean,
): string {
  const link = (target: "rendered" | "source" | "edit", label: string) =>
    `<a class="${view === target ? "is-selected" : ""}" href="${
      escapeHtml(markdownViewHref(url, target))
    }"${view === target ? ' aria-current="true"' : ""}>${label}</a>`;
  return `<nav class="markdown-view-toggle" aria-label="Markdown view">${
    link("rendered", "Rendered")
  }${link("source", "Source")}${editable ? link("edit", "Edit") : ""}</nav>`;
}

function renderTextViewToggle(url: URL, edit: boolean): string {
  const link = (target: "rendered" | "edit", label: string) =>
    `<a class="${edit === (target === "edit") ? "is-selected" : ""}" href="${
      escapeHtml(markdownViewHref(url, target))
    }"${
      edit === (target === "edit") ? ' aria-current="true"' : ""
    }>${label}</a>`;
  return `<nav class="markdown-view-toggle" aria-label="Text view">${
    link("rendered", "Source")
  }${link("edit", "Edit")}</nav>`;
}

function renderSourcePanel(model: PageModel): string {
  return `<section class="markdown-source-panel" aria-label="Markdown source">${model.content}</section>`;
}

function renderEditPage(model: PageModel): string {
  return `<section class="markdown-source-panel markdown-edit-panel" aria-label="File editor"><form class="edit-page" method="post" action="${
    escapeHtml(markdownViewHref(model.url, "edit"))
  }" data-edit-path="${
    escapeHtml(model.editPath ?? "")
  }"><input type="hidden" name="etag" value="${
    escapeHtml(model.editTag ?? "")
  }"><p class="edit-status" role="status">${
    escapeHtml(model.editStatus ?? "Editing")
  }</p><div class="edit-surface"><pre class="edit-highlight" aria-hidden="true"><code>${
    model.editHighlight ?? ""
  }</code></pre><div class="edit-gutter" aria-label="Git changes"></div><textarea class="edit-text" name="content" spellcheck="false" aria-label="File contents">${
    escapeHtml(model.editText ?? "")
  }</textarea></div><section class="edit-hunk-details" aria-label="Git change" hidden><pre></pre><div><button class="edit-hunk-close" type="button">Close diff</button><button class="edit-hunk-revert" type="button">Revert change in editor</button></div></section>${
    model.editCurrentText === undefined
      ? ""
      : `<details class="edit-current"><summary>Current file on disk</summary><pre>${
        escapeHtml(model.editCurrentText)
      }</pre></details>`
  }<div class="edit-buttons"><button type="submit">Save</button></div></form></section>`;
}

function renderPageContent(model: PageModel): string {
  if (model.markdownView !== undefined) {
    return `<div class="page-content page-content-markdown">${model.content}</div>`;
  }
  if (!model.fileActions?.length) {
    return model.content;
  }
  if (model.fileActionPlacement === "toolbar") {
    const conditional = model.fileActions.filter((action) =>
      action.kind === "page"
    );
    const common = model.fileActions.filter((action) =>
      action.kind === "raw" || action.kind === "download"
    );
    return model.content.replace(
      '<span class="code-toolbar-file-actions" data-file-actions="leading"></span>',
      `<span class="code-toolbar-file-actions" data-file-actions="leading">${
        renderFileActions(conditional)
      }</span>`,
    ).replace(
      '<span class="code-toolbar-file-actions" data-file-actions="trailing"></span>',
      `<span class="code-toolbar-file-actions" data-file-actions="trailing">${
        renderFileActions(common)
      }</span>`,
    );
  }
  const placement = model.fileActionPlacement ?? "top";
  return `<div class="page-content page-content-${placement}"><div class="file-actions file-actions-${placement}">${
    renderFileActions(model.fileActions)
  }</div>${model.content}</div>`;
}

function reloadClient(config: ServerConfig): string {
  return config.reloadSource ? `<script>${reloadClientScript}</script>` : "";
}

function renderFileActions(actions: FileAction[]): string {
  return actions.map((action) =>
    renderPageAction(
      action,
      action.kind === "raw"
        ? "file-action raw-link"
        : action.kind === "download"
        ? "file-action download-link"
        : "file-action",
    )
  ).join("");
}

function renderPageAction(
  action: HeaderAction | FileAction,
  className = "page-action",
): string {
  const queryRemove = "queryRemove" in action ? action.queryRemove : undefined;
  const queryScope = "queryScope" in action ? action.queryScope : undefined;
  const title = action.title;
  const target = "target" in action
    ? ` target="${action.target}" rel="noopener"`
    : "";
  return `<a class="${className}" href="${escapeHtml(action.href)}"${target}${
    queryRemove?.length
      ? ` data-query-remove="${escapeHtml(queryRemove.join(" "))}"`
      : ""
  }${queryScope ? ` data-query-scope="${queryScope}"` : ""} title="${
    escapeHtml(title)
  }" aria-label="${escapeHtml(title)}">${escapeHtml(action.label)}</a>`;
}
