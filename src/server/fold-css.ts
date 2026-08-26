export const foldCss = `
.markdown-toc { float: right; font-size: .875em; margin: 0 0 1rem 1.5rem; max-width: min(20rem, 45%); position: relative; z-index: 1; }
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
.markdown-toc a.is-current { background: var(--tree-active); border-radius: 4px; color: #fff; display: block; font-weight: 600; margin-inline: -4px; padding: 2px 4px; text-decoration: none; }
.markdown-toc a.is-current:hover, .markdown-toc a.is-current:focus-visible { color: #fff; text-decoration: underline; }
.markdown-body :is(h1, h2, h3, h4, h5, h6):target { background: var(--code-hover); border-radius: 4px; outline: 2px solid var(--focus-color); outline-offset: 2px; scroll-margin-block-start: 1rem; }
.markdown-toc-level-2 { margin-left: .7rem; }
.markdown-toc-level-3 { margin-left: 1.4rem; }
.markdown-toc-level-4 { margin-left: 2.1rem; }
.markdown-toc-level-5 { margin-left: 2.8rem; }
.markdown-toc-level-6 { margin-left: 3.5rem; }
@media (max-width: 800px) { .markdown-toc { float: none; margin: 0 0 1rem; max-width: none; } }
`;
