import { CSS } from "@deno/gfm";
import { codeToolbarCss } from "./code-toolbar-css.ts";

export const pageCss = `${CSS}
:root { color-scheme: light dark; --code-bg: #f6f8fa; --code-border: #d0d7de; --code-hover: #eaeef2; --code-muted: #57606a; --code-text: #24292f; --focus-color: #0969da; --tree-active: #0969da; --tree-bg: #f6f8fa; --tree-border: #d0d7de; --tree-hover: #eaeef2; --tree-muted: #57606a; --tree-text: #24292f; }
@media (prefers-color-scheme: dark) { :root { --code-bg: #161b22; --code-border: #30363d; --code-hover: #21262d; --code-muted: #8b949e; --code-text: #c9d1d9; --focus-color: #58a6ff; --tree-active: #1f6feb; --tree-bg: #161b22; --tree-border: #30363d; --tree-hover: #21262d; --tree-muted: #8b949e; --tree-text: #f0f6fc; } }
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
.tree summary { align-items: center; border-radius: 4px; cursor: pointer; display: flex; list-style: none; min-width: 0; }
.tree summary::-webkit-details-marker { display: none; }
.tree summary::before { border: 4px solid transparent; border-left-color: var(--tree-muted); content: ""; flex: 0 0 auto; margin: 0 2px 0 4px; transform: translateY(1px); }
.tree details[open] > summary::before { transform: rotate(90deg) translateX(2px); }
.tree summary a { flex: 1; }
.tree-heading { color: var(--tree-muted); display: block; font-size: 12px; font-weight: 600; padding: 5px 6px; text-transform: uppercase; }
.tree-root { font-weight: 600; }
.content { min-width: 0; padding: 8px 16px 32px; }
.browse { display: none; }
${codeToolbarCss}
@media (max-width: 700px) {
  .layout { display: flex; flex-direction: column; gap: 12px; padding: 12px; }
  .content { order: 1; padding: 0; }
  .tree { display: none; max-height: none; order: 2; position: static; width: auto; }
  .tree[data-open="true"] { display: block; }
  .browse { background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 6px; color: var(--tree-text); display: block; margin: 12px 12px 0; padding: 8px 12px; text-align: left; width: calc(100% - 24px); }
}`;
