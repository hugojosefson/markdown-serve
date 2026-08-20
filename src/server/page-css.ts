import { CSS } from "@deno/gfm";
import { codeToolbarCss } from "./code-toolbar-css.ts";
import { displayControlsCss } from "./display-controls-css.ts";

export const pageCss = `${CSS}
:root { color-scheme: light dark; --code-bg: #f6f8fa; --code-border: #d0d7de; --code-hover: #eaeef2; --code-muted: #57606a; --code-text: #24292f; --focus-color: #0969da; --tree-active: #0969da; --tree-bg: #f6f8fa; --tree-border: #d0d7de; --tree-hover: #eaeef2; --tree-muted: #57606a; --tree-text: #24292f; }
@media (prefers-color-scheme: dark) { :root { --code-bg: #161b22; --code-border: #30363d; --code-hover: #21262d; --code-muted: #8b949e; --code-text: #c9d1d9; --focus-color: #58a6ff; --tree-active: #1f6feb; --tree-bg: #161b22; --tree-border: #30363d; --tree-hover: #21262d; --tree-muted: #8b949e; --tree-text: #f0f6fc; } }
html[data-color-mode="light"] { color-scheme: light; --code-bg: #f6f8fa; --code-border: #d0d7de; --code-hover: #eaeef2; --code-muted: #57606a; --code-text: #24292f; --focus-color: #0969da; --tree-active: #0969da; --tree-bg: #f6f8fa; --tree-border: #d0d7de; --tree-hover: #eaeef2; --tree-muted: #57606a; --tree-text: #24292f; }
html[data-color-mode="dark"] { color-scheme: dark; --code-bg: #161b22; --code-border: #30363d; --code-hover: #21262d; --code-muted: #8b949e; --code-text: #c9d1d9; --focus-color: #58a6ff; --tree-active: #1f6feb; --tree-bg: #161b22; --tree-border: #30363d; --tree-hover: #21262d; --tree-muted: #8b949e; --tree-text: #f0f6fc; }
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
.tree summary, .tree .tree-root-row { align-items: center; border-radius: 4px; display: flex; min-width: 0; position: relative; }
.tree summary { cursor: pointer; list-style: none; }
.tree summary::-webkit-details-marker { display: none; }
.tree summary::before { border: 4px solid transparent; border-left-color: var(--tree-muted); content: ""; flex: 0 0 auto; margin: 0 2px 0 4px; transform: translateY(1px); }
.tree details[open] > summary::before { transform: rotate(90deg) translateX(2px); }
.tree summary > .tree-folder-link, .tree .tree-root-row > .tree-root { flex: 1; }
.tree .tree-files-link { align-items: center; background: var(--tree-hover); bottom: 0; color: var(--tree-muted); display: flex; font-size: 11px; opacity: 0; padding: 0 5px; pointer-events: none; position: absolute; right: 0; top: 0; }
.tree summary:hover .tree-files-link, .tree summary:focus-within .tree-files-link, .tree .tree-root-row:hover .tree-files-link, .tree .tree-root-row:focus-within .tree-files-link, .tree .tree-files-link:focus-visible { opacity: 1; pointer-events: auto; }
.tree a.tree-heading { color: var(--tree-muted); display: block; font-size: 12px; font-weight: 600; padding: 5px 6px; text-transform: uppercase; }
.tree-root { font-weight: 600; }
.content { min-width: 0; padding: 8px 16px 32px; }
.content-header { align-items: center; display: flex; gap: 8px; margin-bottom: 8px; }
.content-header nav { line-height: 22px; min-width: 0; overflow-wrap: anywhere; }
.breadcrumb-separator { margin: 0 4px; }
.content-header .page-action, .content-header .raw-link { align-items: center; background: transparent; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-muted); display: inline-flex; flex: 0 0 auto; font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 22px; padding: 0 7px; text-decoration: none; }
.content-header .page-action:hover, .content-header .page-action:focus-visible, .content-header .raw-link:hover, .content-header .raw-link:focus-visible { color: var(--focus-color); }
.content-header .page-action:hover, .content-header .raw-link:hover { background: var(--code-hover); }
.content-header .page-action:focus-visible, .content-header .raw-link:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.browse { display: none; }
.sr-only { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0, 0, 0, 0); }
.directory-table { border-collapse: collapse; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; min-width: 100%; width: max-content; }
.directory-table th, .directory-table td { border-bottom: 1px solid var(--code-border); padding: 6px 8px; text-align: left; }
.directory-table th a { color: inherit; text-decoration: none; }
.directory-table .directory-size, .directory-table .directory-user { font-variant-numeric: tabular-nums; text-align: right; }
.directory-table .directory-permissions, .directory-table .directory-size, .directory-table .directory-user, .directory-table .directory-modified { white-space: nowrap; width: 1%; }
.directory-table .directory-name { min-width: 12rem; width: 100%; }
.directory-table .directory-modified { font-variant-numeric: tabular-nums; white-space: nowrap; }
.directory-table .timestamp-separator { color: var(--code-muted); }
.directory-table .timestamp-t { display: inline-block; margin: 0 .25ch; }
.directory-table .timestamp-t, .directory-table .timestamp-zone { opacity: .2; }
.directory-scroll { max-width: 100%; overflow-x: auto; width: 100%; }
${codeToolbarCss}
${displayControlsCss}
@media (max-width: 700px) {
  .layout { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
  .content { order: 1; padding: 0; }
  .tree { display: none; max-height: none; order: 2; position: static; width: auto; }
  .tree:target { display: block; }
  .browse { background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 6px; color: var(--tree-text); display: block; margin: 12px 12px 0; padding: 8px 12px; text-align: left; text-decoration: none; width: calc(100% - 24px); }
}`;
