export const editCss = `
.edit-page { display: grid; gap: 10px; padding: 12px; }
.edit-status { color: var(--code-muted); font: 13px ui-monospace, monospace; margin: 0; }
.edit-surface { display: grid; min-height: 65vh; overflow: hidden; position: relative; }
.edit-highlight, .edit-text { box-sizing: border-box; font: 13px/1.45 ui-monospace, monospace; grid-area: 1 / 1; margin: 0; min-height: 65vh; overflow: auto; padding: 12px 12px 12px 28px; tab-size: 2; white-space: pre; width: 100%; }
.edit-highlight { background: var(--code-bg); border: 0; pointer-events: none; }
.edit-highlight code { background: transparent; display: block; font: inherit; padding: 0; }
.edit-text { background: var(--code-bg); border: 0; color: var(--code-text); resize: vertical; z-index: 1; }
.edit-surface.is-enhanced .edit-text { background: transparent; caret-color: var(--code-text); color: transparent; }
.edit-surface.is-enhanced .edit-text::selection { background: color-mix(in srgb, var(--focus-color) 35%, transparent); color: transparent; }
.edit-gutter { bottom: 12px; font: 13px/1.45 ui-monospace, monospace; left: 8px; pointer-events: none; position: absolute; right: auto; top: 12px; width: 12px; z-index: 2; }
.edit-hunk { background: var(--git-modified); border: 0; border-radius: 2px; cursor: pointer; height: max(3px, calc(var(--edit-lines) * 1.45em)); left: 0; padding: 0; pointer-events: auto; position: absolute; top: calc((var(--edit-line) - 1) * 1.45em); width: 7px; }
.edit-hunk:hover, .edit-hunk:focus-visible { background: var(--focus-color); width: 11px; }
.edit-hunk:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; }
.edit-hunk-details, .edit-current { background: var(--code-bg); border: 1px solid var(--code-border); border-radius: 6px; margin: 0 12px; padding: 10px; }
.edit-hunk-details pre, .edit-current pre { max-height: 35vh; overflow: auto; white-space: pre; }
.edit-hunk-details > div, .edit-buttons { display: flex; gap: 8px; justify-content: end; }
.edit-current summary { cursor: pointer; }
`;
