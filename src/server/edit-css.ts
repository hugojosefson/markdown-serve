export const editCss = `
.edit-page { display: grid; gap: 10px; padding: 12px; }
.edit-status { color: var(--code-muted); font: 13px ui-monospace, monospace; margin: 0; }
.edit-workspace.is-markdown { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr) minmax(18rem, .8fr); }
.edit-surface { display: grid; min-height: 65vh; overflow: hidden; position: relative; }
.edit-highlight, .edit-text { box-sizing: border-box; font: 13px/1.45 ui-monospace, monospace; grid-area: 1 / 1; margin: 0; min-height: 65vh; overflow: auto; padding: 12px 12px 12px 28px; tab-size: 2; white-space: pre; width: 100%; }
.edit-highlight, .edit-highlight.code-block { background: var(--code-bg); border: 0; border-radius: 0; margin: 0; pointer-events: none; }
.edit-highlight code { background: transparent; display: block; font: inherit; padding: 0; }
.edit-text { background: var(--code-bg); border: 0; color: var(--code-text); resize: vertical; z-index: 1; }
.edit-surface.is-enhanced .edit-text { background: transparent; caret-color: var(--code-text); color: transparent; }
.edit-surface.is-enhanced .edit-text::selection { background: color-mix(in srgb, var(--focus-color) 35%, transparent); color: transparent; }
.edit-highlight.code-block .token.property, .edit-highlight.code-block .token.constant, .edit-highlight.code-block .token.symbol { color: #0550ae; }
.edit-highlight.code-block .token.operator, .edit-highlight.code-block .token.entity { color: #cf222e; }
.edit-highlight.code-block .token.punctuation { color: var(--code-muted); }
.edit-highlight.code-block .token.title { color: var(--focus-color); font-weight: 700; }
.edit-highlight.code-block .token.edit-heading-1 { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: .2em; }
.edit-highlight.code-block .token.edit-heading-2 { text-decoration: underline; text-underline-offset: .2em; }
.edit-highlight.code-block .token.bold { color: var(--code-text); font-weight: 700; }
.edit-highlight.code-block .token.italic { color: var(--code-muted); font-style: italic; }
.edit-highlight.code-block .token.url { color: var(--focus-color); text-decoration: underline; text-underline-offset: .14em; }
.edit-highlight.code-block .token.code-snippet { background: var(--code-hover); border-radius: 3px; color: var(--git-added); }
.edit-markdown-preview { border: 1px solid var(--code-border); border-radius: 6px; box-sizing: border-box; max-height: 65vh; overflow: auto; padding: 12px 18px; }
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
@media (max-width: 900px) { .edit-workspace.is-markdown { grid-template-columns: 1fr; } .edit-markdown-preview { max-height: 45vh; } }
`;
