export const codeToolbarCss = `
.code-block { border: 1px solid var(--code-border); border-radius: 6px; margin: 16px 0; overflow: hidden; }
.code-toolbar { align-items: center; background: var(--code-bg); border-bottom: 1px solid var(--code-border); box-sizing: border-box; display: flex; min-height: 29px; overflow-x: auto; overscroll-behavior-inline: contain; padding: 3px 3px 3px 8px; scrollbar-width: thin; }.code-toolbar > * { flex: 0 0 auto; }
.code-language { color: var(--code-muted); font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .03em; text-transform: lowercase; }
.code-toolbar-file-actions { align-items: center; display: flex; gap: 4px; }.code-toolbar-file-actions[data-file-actions="leading"] { margin-left: auto; }.code-toolbar-file-actions[data-file-actions="trailing"] { margin-left: 4px; }.code-toolbar-file-actions[data-file-actions="trailing"]:empty { margin-left: 0; }
.code-toolbar .file-action, .code-copy { align-items: center; appearance: none; background: transparent; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-muted); cursor: pointer; display: inline-flex; font: 500 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 22px; justify-content: center; padding: 0 7px; text-decoration: none; }
.code-copy { min-width: 46px; }
.code-copy:hover { background: var(--code-hover); }
.code-copy:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.code-copy-status { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0 0 0 0); white-space: nowrap; }
.code-block > .highlight, .code-block > pre { border: 0; border-radius: 0; margin: 0; }
.code-block > .highlight pre, .code-block > pre { background: var(--code-bg); color: var(--code-text); }
.code-block > .highlight pre:has(.source-line), .code-block > pre:has(.source-line) { overflow-x: auto; padding: 0; }
.source-line { display: grid; grid-template-columns: max-content minmax(max-content, 1fr); min-width: max-content; }
.source-line:target { background: var(--code-hover); }
.code-block .source-line-number { color: var(--code-muted); font-weight: 400; opacity: .6; padding: 0 12px 0 10px; text-align: right; text-decoration: none; user-select: none; }
.source-line-number::before { content: attr(data-line); }
.code-block .source-line-number:hover, .code-block .source-line-number:focus-visible { background: var(--code-hover); color: var(--focus-color); opacity: 1; }
.source-line-number:focus-visible { outline: 2px solid var(--focus-color); outline-offset: -2px; }
.source-line-content { min-width: 0; white-space: pre; }
.source-line-break { display: none; }
@media (max-width: 560px) { .source-line-number { padding-left: 7px; padding-right: 8px; } }
.code-block .token.comment, .code-block .token.prolog, .code-block .token.doctype, .code-block .token.cdata { color: var(--color-prettylights-syntax-comment); }
.code-block .token.keyword, .code-block .token.atrule { color: var(--color-prettylights-syntax-keyword); }
.code-block .token.string, .code-block .token.attr-value, .code-block .token.regex { color: var(--color-prettylights-syntax-string); }
.code-block .token.function { color: var(--color-prettylights-syntax-entity); }
.code-block .token.class-name { color: var(--color-prettylights-syntax-variable); }
.code-block .token.number, .code-block .token.boolean { color: var(--color-prettylights-syntax-constant); }
`;
