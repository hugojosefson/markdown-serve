export const editCss = `
.edit-page { --edit-font-size: 13px; display: grid; gap: 10px; padding: 12px; }
.edit-status { color: var(--code-muted); font: 13px ui-monospace, monospace; margin: 0; }
.edit-layout-controls { display: flex; justify-content: end; }
.edit-layout-controls a { align-items: center; background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 0; color: var(--code-muted); display: inline-flex; height: 28px; justify-content: center; margin-left: -1px; padding: 0; width: 34px; }
.edit-layout-controls a:first-child { border-radius: 6px 0 0 6px; margin-left: 0; }
.edit-layout-controls a:last-child { border-radius: 0 6px 6px 0; }
.edit-layout-controls a:hover, .edit-layout-controls a.is-selected { background: var(--code-hover); color: var(--focus-color); }
.edit-layout-controls a:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; z-index: 1; }
.edit-layout-controls svg { fill: none; height: 16px; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; width: 16px; }
.edit-workspace.is-markdown { display: grid; min-width: 0; }
.edit-workspace.is-markdown[data-edit-layout="editor"] .edit-markdown-preview { display: none; }
.edit-workspace.is-markdown[data-edit-layout="split-horizontal"], .edit-workspace.is-markdown[data-edit-layout="split-vertical"] { gap: 12px; height: 65vh; min-height: 0; }
.edit-workspace.is-markdown[data-edit-layout="split-horizontal"] { grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
.edit-workspace.is-markdown[data-edit-layout="split-vertical"] { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.edit-workspace.is-markdown[data-edit-layout="split-horizontal"] .edit-surface, .edit-workspace.is-markdown[data-edit-layout="split-vertical"] .edit-surface { min-height: 0; }
.edit-workspace.is-markdown[data-edit-layout="split-horizontal"] .edit-highlight, .edit-workspace.is-markdown[data-edit-layout="split-horizontal"] .edit-text, .edit-workspace.is-markdown[data-edit-layout="split-vertical"] .edit-highlight, .edit-workspace.is-markdown[data-edit-layout="split-vertical"] .edit-text { height: 100%; min-height: 0; resize: none; }
.edit-workspace.is-markdown[data-edit-layout="split-horizontal"] .edit-markdown-preview, .edit-workspace.is-markdown[data-edit-layout="split-vertical"] .edit-markdown-preview { max-height: none; min-height: 0; }
.edit-workspace.is-markdown[data-edit-layout="preview"] .edit-surface { display: none; }
.edit-workspace.is-markdown[data-edit-layout="preview"] .edit-markdown-preview { max-height: none; min-height: 65vh; }
.edit-surface { display: grid; min-height: 65vh; overflow: hidden; position: relative; }
.edit-highlight, .edit-text { box-sizing: border-box; font: var(--edit-font-size)/1.45 ui-monospace, monospace; font-kerning: none; font-variant-ligatures: none; grid-area: 1 / 1; letter-spacing: 0; margin: 0; min-height: 65vh; overflow: auto; padding: 12px 12px 12px 28px; tab-size: 2; white-space: pre; width: 100%; }
.edit-highlight, .edit-highlight.code-block { background: var(--code-bg); border: 0; border-radius: 0; font-size: var(--edit-font-size); margin: 0; pointer-events: none; }
.edit-highlight.code-block { padding: 12px 12px 12px 28px; }
.edit-highlight code, .edit-highlight.code-block > code { background: transparent; display: block; font: inherit; font-size: var(--edit-font-size); padding: 0; }
.edit-text { appearance: none; background: var(--code-bg); border: 0; color: var(--code-text); resize: vertical; z-index: 1; }
.edit-surface.is-enhanced .edit-text { background: transparent; caret-color: var(--code-text); color: transparent; }
.edit-surface.is-enhanced .edit-text::selection { background: color-mix(in srgb, var(--focus-color) 35%, transparent); color: transparent; }
.edit-highlight.code-block .token { font: inherit; letter-spacing: inherit; }
.edit-highlight.code-block .token.property, .edit-highlight.code-block .token.constant, .edit-highlight.code-block .token.symbol { color: #0550ae; }
.edit-highlight.code-block .token.operator, .edit-highlight.code-block .token.entity { color: #cf222e; }
.edit-highlight.code-block .token.punctuation { color: var(--code-muted); }
.edit-highlight.code-block .token.title { color: var(--focus-color); }
.edit-highlight.code-block .token.edit-heading-1 { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: .2em; }
.edit-highlight.code-block .token.edit-heading-2 { text-decoration: underline; text-underline-offset: .2em; }
.edit-highlight.code-block .token.bold { color: var(--git-modified); }
.edit-highlight.code-block .token.italic { color: var(--code-muted); }
.edit-highlight.code-block .token.url { color: var(--focus-color); text-decoration: underline; text-underline-offset: .14em; }
.edit-highlight.code-block .token.code-snippet { background: var(--code-hover); border-radius: 3px; color: var(--git-added); }
.edit-markdown-preview { border: 1px solid var(--code-border); border-radius: 6px; box-sizing: border-box; max-height: 65vh; overflow: auto; padding: 12px 18px; }
::highlight(edit-preview-caret) { background: color-mix(in srgb, var(--focus-color) 28%, transparent); text-decoration: underline 2px var(--focus-color); }
::highlight(edit-preview-selection) { background: color-mix(in srgb, var(--focus-color) 38%, transparent); }
.edit-gutter { bottom: 12px; font: 13px/1.45 ui-monospace, monospace; left: 8px; pointer-events: none; position: absolute; right: auto; top: 12px; width: 12px; z-index: 2; }
.edit-hunk { background: var(--git-modified); border: 0; border-radius: 2px; cursor: pointer; height: max(3px, calc(var(--edit-lines) * 1.45em)); left: 0; padding: 0; pointer-events: auto; position: absolute; top: calc((var(--edit-line) - 1) * 1.45em); width: 7px; }
.edit-hunk:hover, .edit-hunk:focus-visible { background: var(--focus-color); width: 11px; }
.edit-hunk:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; }
.edit-hunk-details, .edit-current { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; margin: 0 12px; padding: 10px; }
.edit-hunk-details pre, .edit-current pre { max-height: 35vh; overflow: auto; white-space: pre; }
.edit-hunk-details > div, .edit-buttons { display: flex; gap: 8px; justify-content: end; }
.edit-current summary { cursor: pointer; }
html[data-color-mode="dark"] .edit-highlight.code-block .token.property, html[data-color-mode="dark"] .edit-highlight.code-block .token.constant, html[data-color-mode="dark"] .edit-highlight.code-block .token.symbol { color: #79c0ff; }
html[data-color-mode="dark"] .edit-highlight.code-block .token.operator, html[data-color-mode="dark"] .edit-highlight.code-block .token.entity { color: #ff7b72; }
@media (prefers-color-scheme: dark) { html[data-color-mode="auto"] .edit-highlight.code-block .token.property, html[data-color-mode="auto"] .edit-highlight.code-block .token.constant, html[data-color-mode="auto"] .edit-highlight.code-block .token.symbol { color: #79c0ff; } html[data-color-mode="auto"] .edit-highlight.code-block .token.operator, html[data-color-mode="auto"] .edit-highlight.code-block .token.entity { color: #ff7b72; } }
@media (max-width: 900px) { .edit-workspace.is-markdown[data-edit-layout="split-vertical"] { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); } }
`;
