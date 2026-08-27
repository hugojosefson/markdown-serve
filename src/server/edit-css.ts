export const editCss = `
.edit-file { cursor: pointer; }
.edit-dialog { border: 1px solid var(--code-border); border-radius: 6px; color: var(--code-text); background: var(--code-bg); max-width: min(90vw, 70rem); width: 70rem; }
.edit-dialog::backdrop { background: rgb(0 0 0 / .45); }
.edit-dialog form { display: grid; gap: 10px; }
.edit-text { box-sizing: border-box; min-height: 55vh; resize: vertical; width: 100%; white-space: pre; font: 13px ui-monospace, monospace; }
.edit-dialog div { display: flex; gap: 8px; justify-content: end; }
`;
