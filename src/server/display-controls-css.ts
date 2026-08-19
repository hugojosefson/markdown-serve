export const displayControlsCss = `
.display-controls { align-items: center; background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 6px; color: var(--tree-text); display: flex; font: 13px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; gap: 8px; margin: 0; padding: 6px 8px; }
.display-controls label { align-items: center; display: flex; gap: 4px; }
.display-controls select { background: var(--tree-bg); border: 1px solid var(--tree-border); border-radius: 4px; color: inherit; font: inherit; padding: 3px; }
.display-controls select:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
.page-toolbar { align-items: center; display: flex; justify-content: flex-end; margin: 12px auto -4px; max-width: 1280px; padding: 0 16px; }
html[data-width="wide"] .layout, html[data-width="wide"] .page-toolbar { max-width: none; }
@media (max-width: 700px) { .page-toolbar { margin: 12px 0 -4px; padding: 0 12px; } }
`;
