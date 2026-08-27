export const fileSearchCss = `
.go-to-file { background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 8px; color: var(--tree-text); max-width: min(42rem, calc(100vw - 32px)); padding: 0; width: 100%; }
.go-to-file::backdrop { background: rgb(0 0 0 / .35); }
.go-to-file form { padding: 14px; }
.go-to-file label { display: grid; font: 600 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; gap: 6px; }
.go-to-file input { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 5px; color: var(--code-text); font: 14px/1.4 ui-monospace, monospace; padding: 7px; }
.go-to-file-status { color: var(--tree-muted); font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 8px 0; }
.go-to-file ul { list-style: none; margin: 0; max-height: min(50vh, 30rem); overflow: auto; padding: 0; }
.go-to-file li[data-selected="true"] { background: var(--tree-hover); }
.go-to-file a { color: inherit; display: block; font: 13px/1.4 ui-monospace, monospace; overflow: hidden; padding: 5px 7px; text-decoration: none; text-overflow: ellipsis; white-space: nowrap; }
`;
