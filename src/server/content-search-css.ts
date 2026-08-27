export const contentSearchCss = `
.content-search { background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 8px; color: var(--tree-text); max-width: min(52rem, calc(100vw - 32px)); width: 100%; }
.content-search input[type="search"], .content-search input[type="text"], .content-search input[type="number"] { box-sizing: border-box; padding: 8px; }
.content-search input[type="search"] { width: 100%; }
.content-search fieldset { display: flex; flex-wrap: wrap; gap: 8px; }
.content-search ul { list-style: none; max-height: 50vh; overflow: auto; padding: 0; }
.content-search a { color: inherit; display: block; font: 13px/1.4 ui-monospace, monospace; overflow: hidden; padding: 6px; text-decoration: none; text-overflow: ellipsis; white-space: pre; }
.content-search [data-context] { display: block; opacity: .75; }
.content-search [data-selected="true"] { outline: 1px solid var(--tree-border); }
`;
