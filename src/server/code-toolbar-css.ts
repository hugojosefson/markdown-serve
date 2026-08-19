export const codeToolbarCss = `
.code-block { border: 1px solid var(--code-border); border-radius: 6px; margin: 16px 0; overflow: hidden; }
.code-toolbar { align-items: center; background: var(--code-bg); border-bottom: 1px solid var(--code-border); display: flex; height: 26px; padding: 0 6px 0 8px; }
.code-language { color: var(--code-muted); font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .03em; text-transform: lowercase; }
.code-copy { background: transparent; border: 1px solid var(--code-border); border-radius: 4px; color: var(--code-text); cursor: pointer; font: 500 12px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin-left: auto; padding: 0 7px; }
.code-copy:hover { background: var(--code-hover); }
.code-copy:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.code-copy-status { height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; clip: rect(0 0 0 0); white-space: nowrap; }
.code-block > .highlight, .code-block > pre { border: 0; border-radius: 0; margin: 0; }
.code-block > .highlight pre, .code-block > pre { background: var(--code-bg); color: var(--code-text); }
.code-block .token.comment, .code-block .token.prolog, .code-block .token.doctype, .code-block .token.cdata { color: #57606a; }
.code-block .token.keyword, .code-block .token.atrule { color: #cf222e; }
.code-block .token.string, .code-block .token.attr-value, .code-block .token.regex { color: #0a3069; }
.code-block .token.function, .code-block .token.class-name { color: #8250df; }
.code-block .token.number, .code-block .token.boolean { color: #0550ae; }
@media (prefers-color-scheme: dark) { .code-block .token.comment, .code-block .token.prolog, .code-block .token.doctype, .code-block .token.cdata { color: #8b949e; } .code-block .token.keyword, .code-block .token.atrule { color: #ff7b72; } .code-block .token.string, .code-block .token.attr-value, .code-block .token.regex { color: #a5d6ff; } .code-block .token.function, .code-block .token.class-name { color: #d2a8ff; } .code-block .token.number, .code-block .token.boolean { color: #79c0ff; } }
`;
