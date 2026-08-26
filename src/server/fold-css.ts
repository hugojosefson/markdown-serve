export const foldCss = `
.content-header .markdown-source-tab { align-items: center; background: transparent; border: 1px solid var(--code-border); border-radius: 4px; color: var(--code-muted); display: inline-flex; flex: 0 0 auto; font: 500 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; height: 22px; margin-left: auto; padding: 0 7px; text-decoration: none; }
.content-header .markdown-source-tab + .file-metadata, .content-header .file-actions-source + .file-metadata { margin-left: 0; }
.content-header .markdown-source-tab:hover, .content-header .markdown-source-tab:focus-visible { background: var(--code-hover); color: var(--focus-color); }
.content-header .markdown-source-tab:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.content-header.source-expanded .markdown-source-tab { background: var(--code-hover); border-color: var(--code-border); border-bottom-color: var(--code-hover); border-radius: 6px 6px 0 0; color: var(--focus-color); position: relative; z-index: 1; }
.content-header.source-expanded .markdown-source-tab::after { background: var(--code-hover); border-left: 1px solid var(--code-border); border-right: 1px solid var(--code-border); box-sizing: border-box; content: ""; height: 16px; left: -1px; position: absolute; right: -1px; top: 100%; }
.content-header .file-actions-source { margin-left: 0; }
.markdown-source-panel { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; margin: 14px 0 16px; overflow: hidden; }
.markdown-source-panel-header { align-items: center; background: var(--code-hover); border-bottom: 1px solid var(--code-border); color: var(--focus-color); display: flex; font: 700 10px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .06em; min-height: 30px; padding: 0 6px 0 12px; text-transform: uppercase; }
.markdown-source-close { align-items: center; border: 1px solid var(--code-border); border-radius: 4px; box-sizing: border-box; color: var(--code-muted); display: inline-flex; height: 22px; justify-content: center; margin-left: auto; text-decoration: none; width: 22px; }
.markdown-source-close svg { fill: none; height: 12px; stroke: currentColor; stroke-linecap: round; stroke-width: 1.5; width: 12px; }
.markdown-source-close:hover, .markdown-source-close:focus-visible { background: var(--code-bg); color: var(--focus-color); }
.markdown-source-close:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.markdown-source-panel > .code-block { border: 0; border-radius: 0; margin: 0; }
.markdown-toc { float: right; font-size: .875em; margin: 30px 0 1rem 1.5rem; max-width: min(20rem, 45%); position: relative; z-index: 1; }
.markdown-toc > summary { align-items: center; background: transparent; border: 1px solid var(--code-border); border-radius: 6px; color: var(--code-muted); cursor: pointer; display: flex; font: 600 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; gap: 8px; list-style: none; min-height: 28px; padding: 0 9px; }
.markdown-toc > summary::-webkit-details-marker { display: none; }
.markdown-toc > summary::after { border: solid currentColor; border-width: 0 1.5px 1.5px 0; content: ""; height: 5px; margin-left: auto; transform: rotate(45deg) translateY(-1px); width: 5px; }
.markdown-toc > summary:hover, .markdown-toc > summary:focus-visible { background: var(--code-hover); color: var(--focus-color); }
.markdown-toc > summary:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.markdown-toc[open] > summary { background: var(--code-hover); border-bottom-color: var(--code-hover); border-radius: 6px 6px 0 0; color: var(--focus-color); position: relative; z-index: 1; }
.markdown-toc[open] > summary::after { transform: rotate(225deg) translate(-1px, -1px); }
.markdown-toc > nav { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 0 0 6px 6px; margin-top: -1px; max-height: min(24rem, 60vh); overflow: auto; overscroll-behavior: contain; padding: 8px 12px; }
.markdown-toc ol { margin: 0; padding-left: 1.2rem; }
.markdown-toc li { margin-block: .25rem; overflow-wrap: anywhere; }
.markdown-toc a { color: inherit; text-decoration: none; }
.markdown-toc a:hover, .markdown-toc a:focus-visible { color: var(--focus-color); text-decoration: underline; }
.markdown-toc-level-2 { margin-left: .7rem; }
.markdown-toc-level-3 { margin-left: 1.4rem; }
.markdown-toc-level-4 { margin-left: 2.1rem; }
.markdown-toc-level-5 { margin-left: 2.8rem; }
.markdown-toc-level-6 { margin-left: 3.5rem; }
@media (max-width: 800px) { .markdown-toc { max-width: 55%; } }
@media (max-width: 560px) { .markdown-toc { float: none; margin: 30px 0 1rem; max-width: none; } .page-content-heading > .markdown-toc + * { padding-right: 0; } }
`;
