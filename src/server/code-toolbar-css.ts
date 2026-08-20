export const codeToolbarCss = `
.code-block { border: 1px solid var(--code-border); border-radius: 6px; margin: 16px 0; overflow: hidden; }
.code-toolbar { align-items: center; background: var(--code-bg); border-bottom: 1px solid var(--code-border); box-sizing: border-box; display: flex; height: 30px; padding: 0 6px 0 8px; }
.code-language { color: var(--code-muted); font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .03em; text-transform: lowercase; }
.code-copy { align-items: center; appearance: none; background: transparent; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-text); cursor: pointer; display: inline-flex; font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 22px; justify-content: center; margin-left: auto; min-width: 46px; padding: 0 7px; }
.code-copy:hover { background: var(--code-hover); }
.code-copy:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.code-copy-status { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0 0 0 0); white-space: nowrap; }
.code-block > .highlight, .code-block > pre { border: 0; border-radius: 0; margin: 0; }
.code-block > .highlight pre, .code-block > pre { background: var(--code-bg); color: var(--code-text); }
.code-block > .highlight pre:has(.source-line), .code-block > pre:has(.source-line) { overflow-x: auto; padding: 0; }
.source-line { display: grid; grid-template-columns: max-content minmax(max-content, 1fr); min-width: max-content; }
.source-line:target { background: var(--code-hover); }
.source-line-number { color: var(--code-muted); padding: 0 12px 0 10px; text-align: right; text-decoration: none; user-select: none; }
.source-line-number::before { content: attr(data-line); }
.source-line-number:hover, .source-line-number:focus-visible { background: var(--code-hover); color: var(--focus-color); }
.source-line-number:focus-visible { outline: 2px solid var(--focus-color); outline-offset: -2px; }
.source-line-content { min-width: 0; white-space: pre; }
@media (max-width: 560px) { .source-line-number { padding-left: 7px; padding-right: 8px; } }
.code-block .token.comment, .code-block .token.prolog, .code-block .token.doctype, .code-block .token.cdata { color: #57606a; }
.code-block .token.keyword, .code-block .token.atrule { color: #cf222e; }
.code-block .token.string, .code-block .token.attr-value, .code-block .token.regex { color: #0a3069; }
.code-block .token.function, .code-block .token.class-name { color: #8250df; }
.code-block .token.number, .code-block .token.boolean { color: #0550ae; }
html[data-color-mode="dark"] .code-block .token.comment, html[data-color-mode="dark"] .code-block .token.prolog, html[data-color-mode="dark"] .code-block .token.doctype, html[data-color-mode="dark"] .code-block .token.cdata { color: #8b949e; }
html[data-color-mode="dark"] .code-block .token.keyword, html[data-color-mode="dark"] .code-block .token.atrule { color: #ff7b72; }
html[data-color-mode="dark"] .code-block .token.string, html[data-color-mode="dark"] .code-block .token.attr-value, html[data-color-mode="dark"] .code-block .token.regex { color: #a5d6ff; }
html[data-color-mode="dark"] .code-block .token.function, html[data-color-mode="dark"] .code-block .token.class-name { color: #d2a8ff; }
html[data-color-mode="dark"] .code-block .token.number, html[data-color-mode="dark"] .code-block .token.boolean { color: #79c0ff; }
@media (prefers-color-scheme: dark) { html[data-color-mode="auto"] .code-block .token.comment, html[data-color-mode="auto"] .code-block .token.prolog, html[data-color-mode="auto"] .code-block .token.doctype, html[data-color-mode="auto"] .code-block .token.cdata { color: #8b949e; } html[data-color-mode="auto"] .code-block .token.keyword, html[data-color-mode="auto"] .code-block .token.atrule { color: #ff7b72; } html[data-color-mode="auto"] .code-block .token.string, html[data-color-mode="auto"] .code-block .token.attr-value, html[data-color-mode="auto"] .code-block .token.regex { color: #a5d6ff; } html[data-color-mode="auto"] .code-block .token.function, html[data-color-mode="auto"] .code-block .token.class-name { color: #d2a8ff; } html[data-color-mode="auto"] .code-block .token.number, html[data-color-mode="auto"] .code-block .token.boolean { color: #79c0ff; } }
`;
