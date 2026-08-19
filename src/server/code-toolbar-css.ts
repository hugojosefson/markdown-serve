export const codeToolbarCss = `
.code-block { border: 1px solid var(--borderColor-muted, #d0d7de); border-radius: 6px; margin: 16px 0; overflow: hidden; }
.code-toolbar { align-items: center; background: var(--bgColor-muted, #f6f8fa); border-bottom: 1px solid var(--borderColor-muted, #d0d7de); display: flex; min-height: 32px; padding: 0 8px; }
.code-language { color: var(--fgColor-muted, #57606a); font: 600 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace; letter-spacing: .03em; text-transform: lowercase; }
.code-copy { background: var(--button-default-bgColor-rest, transparent); border: 1px solid var(--button-default-borderColor-rest, #d0d7de); border-radius: 4px; color: var(--fgColor-default, #24292f); cursor: pointer; font: inherit; font-size: 12px; margin-left: auto; padding: 3px 8px; }
.code-copy:hover { background: var(--button-default-bgColor-hover, #f3f4f6); }
.code-copy:focus-visible { outline: 2px solid var(--focus-outlineColor, #0969da); outline-offset: 2px; }
.code-copy-status { color: var(--fgColor-muted, #57606a); font-size: 12px; margin-left: 8px; min-width: 4.5em; }
.code-block > .highlight, .code-block > pre { border: 0; border-radius: 0; margin: 0; }
`;
