export const displayControlsCss = `
.content-header .display-group { display: inline-flex; flex: 0 0 auto; }
.content-header .display-theme { margin-left: auto; }
.content-header .display-link { align-items: center; border: 1px solid var(--code-border); box-sizing: border-box; color: var(--code-muted); display: inline-flex; flex: 0 0 auto; height: 22px; justify-content: center; margin-left: -1px; text-decoration: none; width: 24px; }
.content-header .display-link:first-child { border-radius: 6px 0 0 6px; margin-left: 0; }
.content-header .display-link:last-child { border-radius: 0 6px 6px 0; }
.content-header .display-link:hover, .content-header .display-link.is-selected { background: var(--code-hover); color: var(--focus-color); }
.content-header .display-link svg { display: block; height: 15px; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; width: 15px; fill: none; }
.content-header .display-link:focus-visible { outline: 2px solid var(--focus-color); outline-offset: 1px; }
html[data-width="wide"] .layout { max-width: none; }
`;
