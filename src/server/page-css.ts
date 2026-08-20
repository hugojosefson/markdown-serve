import { CSS } from "@deno/gfm";
import { codeToolbarCss } from "./code-toolbar-css.ts";
import { displayControlsCss } from "./display-controls-css.ts";

export const pageCss = `${CSS}
:root { color-scheme: light dark; --code-bg: #f6f8fa; --code-border: #d0d7de; --code-hover: #eaeef2; --code-muted: #57606a; --code-text: #24292f; --focus-color: #0969da; --tree-active: #0969da; --tree-bg: #f6f8fa; --tree-border: #d0d7de; --tree-hover: #eaeef2; --tree-muted: #57606a; --tree-text: #24292f; --kind-directory: #8250df; --kind-symlink: #0969da; --kind-executable: #1a7f37; --kind-archive: #bf8700; --kind-image: #cf222e; --kind-media: #0550ae; --kind-file: var(--code-text); --git-conflict: #cf222e; --git-renamed: #8250df; --git-deleted: #cf222e; --git-modified: #bf8700; --git-added: #1a7f37; --git-untracked: #0969da; --git-ignored: var(--code-muted); }
@media (prefers-color-scheme: dark) { :root { --code-bg: #161b22; --code-border: #30363d; --code-hover: #21262d; --code-muted: #8b949e; --code-text: #c9d1d9; --focus-color: #58a6ff; --tree-active: #1f6feb; --tree-bg: #161b22; --tree-border: #30363d; --tree-hover: #21262d; --tree-muted: #8b949e; --tree-text: #f0f6fc; --kind-directory: #d2a8ff; --kind-symlink: #58a6ff; --kind-executable: #7ee787; --kind-archive: #e3b341; --kind-image: #ff7b72; --kind-media: #79c0ff; --kind-file: var(--code-text); --git-conflict: #ff7b72; --git-renamed: #d2a8ff; --git-deleted: #ff7b72; --git-modified: #e3b341; --git-added: #7ee787; --git-untracked: #58a6ff; --git-ignored: var(--code-muted); } }
html[data-color-mode="light"] { color-scheme: light; --code-bg: #f6f8fa; --code-border: #d0d7de; --code-hover: #eaeef2; --code-muted: #57606a; --code-text: #24292f; --focus-color: #0969da; --tree-active: #0969da; --tree-bg: #f6f8fa; --tree-border: #d0d7de; --tree-hover: #eaeef2; --tree-muted: #57606a; --tree-text: #24292f; }
html[data-color-mode="dark"] { color-scheme: dark; --code-bg: #161b22; --code-border: #30363d; --code-hover: #21262d; --code-muted: #8b949e; --code-text: #c9d1d9; --focus-color: #58a6ff; --tree-active: #1f6feb; --tree-bg: #161b22; --tree-border: #30363d; --tree-hover: #21262d; --tree-muted: #8b949e; --tree-text: #f0f6fc; --kind-directory: #d2a8ff; --kind-symlink: #58a6ff; --kind-executable: #7ee787; --kind-archive: #e3b341; --kind-image: #ff7b72; --kind-media: #79c0ff; --kind-file: var(--code-text); --git-conflict: #ff7b72; --git-renamed: #d2a8ff; --git-deleted: #ff7b72; --git-modified: #e3b341; --git-added: #7ee787; --git-untracked: #58a6ff; --git-ignored: var(--code-muted); }
.layout { display: grid; grid-template-columns: 17rem minmax(0, 1fr); gap: 24px; margin: 0 auto; max-width: 1280px; padding: 16px; }
.tree { align-self: start; background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 6px; color: var(--tree-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.45; max-height: calc(100vh - 32px); overflow: auto; padding: 8px; position: sticky; top: 16px; }
.tree nav > ul, .tree ul { list-style: none; margin: 4px 0; padding: 0; }
.tree ul ul { border-left: 1px solid var(--tree-border); margin-left: 11px; padding-left: 8px; }
.tree li { margin: 1px 0; min-width: 0; }
.tree a { border-radius: 4px; color: inherit; display: block; overflow: hidden; padding: 3px 6px; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
.tree li > a { padding-left: 22px; }
.tree summary > a { padding-left: 6px; }
.tree a:hover, .tree summary:hover { background: var(--tree-hover); }
.tree a:focus-visible, .tree summary:focus-visible { outline: 2px solid var(--focus-color); outline-offset: -2px; }
.tree .active { background: var(--tree-active); color: #fff; font-weight: 600; }
.tree a[data-kind], .directory-table a[data-kind] { color: var(--kind-file); }
.tree a[data-kind="directory"], .directory-table a[data-kind="directory"] { color: var(--kind-directory); }
.tree a[data-kind="symlink"], .directory-table a[data-kind="symlink"] { color: var(--kind-symlink); }
.tree a[data-kind="executable"], .directory-table a[data-kind="executable"] { color: var(--kind-executable); }
.tree a[data-kind="archive"], .directory-table a[data-kind="archive"] { color: var(--kind-archive); }
.tree a[data-kind="image"], .directory-table a[data-kind="image"] { color: var(--kind-image); }
.tree a[data-kind="media"], .directory-table a[data-kind="media"] { color: var(--kind-media); }
.tree .active[data-kind] { color: #fff; }
.tree a[data-git-ignored="true"], .directory-table a[data-git-ignored="true"] { opacity: .65; }
.git-marker, .directory-git span { color: var(--git-modified); font-size: .9em; margin-left: 4px; }
[data-git-kind="conflict"] { color: var(--git-conflict); } [data-git-kind="renamed"] { color: var(--git-renamed); } [data-git-kind="deleted"] { color: var(--git-deleted); } [data-git-kind="modified"] { color: var(--git-modified); } [data-git-kind="added"] { color: var(--git-added); } [data-git-kind="untracked"] { color: var(--git-untracked); } [data-git-kind="ignored"] { color: var(--git-ignored); opacity: .65; }
.tree-repo-context { color: var(--tree-muted); font-size: 11px; margin-left: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.tree-repo-context b { color: var(--git-modified); }.repo-context { display: none; }
 .tree summary, .tree .tree-root-row, .tree .tree-entry-row { align-items: center; border-radius: 4px; display: flex; min-width: 0; position: relative; }
.tree summary { cursor: pointer; list-style: none; }
.tree summary::-webkit-details-marker { display: none; }
.tree summary::before { border: 4px solid transparent; border-left-color: var(--tree-muted); content: ""; flex: 0 0 auto; margin: 0 2px 0 4px; transform: translateY(1px); }
.tree details[open] > summary::before { transform: rotate(90deg) translateX(2px); }
 .tree summary > .tree-folder-link, .tree .tree-root-row > .tree-root, .tree .tree-entry-row > :first-child { flex: 1; }
.tree .tree-files-link { align-items: center; background: var(--tree-hover); bottom: 0; color: var(--tree-muted); display: flex; font-size: 11px; opacity: 0; padding: 0 5px; pointer-events: none; position: absolute; right: 0; top: 0; }
 .tree summary:hover .tree-files-link, .tree summary:focus-within .tree-files-link, .tree .tree-root-row:hover .tree-files-link, .tree .tree-root-row:focus-within .tree-files-link, .tree .tree-entry-row:hover .tree-files-link, .tree .tree-entry-row:focus-within .tree-files-link, .tree .tree-files-link:focus-visible { opacity: 1; pointer-events: auto; }
.tree-root { font-weight: 600; }
.content { min-width: 0; padding: 8px 16px 32px; }
.content-header { align-items: center; display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 8px; }
.content-header nav { line-height: 22px; min-width: 0; overflow-wrap: anywhere; }
.breadcrumb-separator { margin: 0 4px; }
.content-header .page-action, .content-header .raw-link { align-items: center; background: transparent; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-muted); display: inline-flex; flex: 0 0 auto; font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 22px; padding: 0 7px; text-decoration: none; }
.content-header .page-action:hover, .content-header .page-action:focus-visible, .content-header .raw-link:hover, .content-header .raw-link:focus-visible { color: var(--focus-color); }
.content-header .page-action:hover, .content-header .raw-link:hover { background: var(--code-hover); }
.content-header .page-action:focus-visible, .content-header .raw-link:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.content-header .file-metadata { border: 1px solid transparent; border-radius: 4px; color: var(--code-muted); flex: 0 0 auto; font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin-left: auto; padding: 2px 5px; text-align: right; text-decoration: none; }
.content-header .file-metadata + .display-theme { margin-left: 0; }
.content-header .file-metadata:hover { background: var(--code-hover); border-color: var(--code-border); color: var(--focus-color); }
.content-header .file-metadata:focus-visible { border-color: var(--code-border); outline: 2px solid var(--focus-color); outline-offset: 1px; }
.content-header .file-metadata span { color: var(--code-border); }
.content-header.metadata-expanded .file-metadata { background: var(--code-hover); border-color: var(--code-border); border-bottom-color: var(--code-hover); border-radius: 6px 6px 0 0; color: var(--focus-color); position: relative; z-index: 1; }
.content-header.metadata-expanded .file-metadata::after { background: var(--code-hover); border-left: 1px solid var(--code-border); border-right: 1px solid var(--code-border); box-sizing: border-box; content: ""; height: 16px; left: -1px; position: absolute; right: -1px; top: 100%; }
.markdown-body .file-metadata-details { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; margin: 14px 0 16px; overflow: hidden; padding: 0; }
.markdown-body .file-metadata-details-header { align-items: center; background: var(--code-hover); border-bottom: 1px solid var(--code-border); color: var(--focus-color); display: flex; font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .06em; min-height: 30px; padding: 0 6px 0 12px; text-transform: uppercase; }
.markdown-body .file-metadata-close { align-items: center; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-muted); display: inline-flex; height: 22px; justify-content: center; margin-left: auto; text-decoration: none; width: 22px; }
.markdown-body .file-metadata-close svg { fill: none; height: 12px; stroke: currentColor; stroke-linecap: round; stroke-width: 1.5; width: 12px; }
.markdown-body .file-metadata-close:hover, .markdown-body .file-metadata-close:focus-visible { background: var(--code-bg); color: var(--focus-color); }
.markdown-body .file-metadata-close:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.markdown-body .file-metadata-details dl { display: grid; gap: 16px 24px; grid-auto-flow: column; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(3, auto); margin: 0; padding: 14px; }
.markdown-body .file-metadata-details dl > div { border-left: 2px solid var(--code-border); display: block; margin: 0; min-width: 0; padding: 0 0 0 10px; }
.markdown-body .file-metadata-details dt { color: var(--focus-color); font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-style: normal; letter-spacing: .06em; margin: 0 0 5px; padding: 0; text-transform: uppercase; }
.markdown-body .file-metadata-details dd { color: var(--code-text); font: 500 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0; overflow-wrap: anywhere; padding: 0; }
.markdown-body .metadata-value-suffix { white-space: nowrap; }
.media-preview { display: block; max-width: 100%; }
.media-preview.image { height: auto; max-height: none; max-width: var(--image-max-width, 100%); width: 100%; }
.media-preview.audio, .media-preview.video { max-width: 100%; width: min(100%, 720px); }
.media-preview.pdf { border: 1px solid var(--code-border); height: min(75vh, 900px); width: 100%; }
.binary-sample { overflow-x: auto; }
.binary-sample pre { white-space: pre; }
.sr-only { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); }
.directory-table { border-collapse: collapse; color: var(--code-text); font: 500 13px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; min-width: 100%; width: max-content; }
.directory-table th, .directory-table td { border-bottom: 1px solid var(--code-border); padding: 8px 10px; text-align: left; }
.directory-table th { background: var(--code-hover); color: var(--focus-color); font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .06em; text-transform: uppercase; }
.directory-table th a { color: inherit; text-decoration: none; }
.directory-table td a { color: var(--code-text); text-decoration: none; }
.directory-table td a:hover, .directory-table td a:focus-visible { color: var(--focus-color); text-decoration: underline; }
.directory-table tbody tr { background: var(--code-bg); }
.directory-table tbody tr:hover { background: var(--code-hover); }
.directory-table tbody tr:last-child td { border-bottom: 0; }
.directory-table .directory-size, .directory-table .directory-user { font-variant-numeric: tabular-nums; text-align: right; }
.directory-table .directory-git, .directory-table .directory-permissions, .directory-table .directory-size, .directory-table .directory-user, .directory-table .directory-modified { white-space: nowrap; width: 1%; }
.directory-table .directory-name { white-space: nowrap; width: 100%; }
.directory-table .directory-modified { font-variant-numeric: tabular-nums; white-space: nowrap; }
.directory-table[data-hidden-columns~="git"] .directory-git, .directory-table[data-hidden-columns~="permissions"] .directory-permissions, .directory-table[data-hidden-columns~="size"] .directory-size, .directory-table[data-hidden-columns~="user"] .directory-user, .directory-table[data-hidden-columns~="modified"] .directory-modified { display: none; }
.directory-table .timestamp-separator, .file-metadata-details .timestamp-separator { color: var(--code-muted); }
.directory-table .timestamp-t, .file-metadata-details .timestamp-t { display: inline-block; margin: 0 .25ch; }
.directory-table .timestamp-t, .directory-table .timestamp-zone, .file-metadata-details .timestamp-t, .file-metadata-details .timestamp-zone { opacity: .2; }
.directory-scroll { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; max-width: 100%; overflow-x: auto; width: 100%; }
${codeToolbarCss}
${displayControlsCss}
@media (max-width: 800px) {
  .markdown-body .file-metadata-details dl { grid-auto-flow: row; grid-template-columns: 1fr; grid-template-rows: none; }
}
@media (max-width: 560px) {
  .layout { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
  .content { order: 1; padding: 0; }
   .tree { display: none; max-height: none; order: 2; position: static; width: auto; }
   .repo-context { color: var(--code-muted); display: block; flex: 1 1 100%; font: 12px/1.4 ui-monospace, monospace; }
  .content-header nav { flex: 1 1 100%; }
  .markdown-body .file-metadata-details dl { padding: 12px; }
}`;
