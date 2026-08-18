import { CSS } from "@deno/gfm";

export const pageCss = `${CSS}
:root { color-scheme: light dark; }
.layout { display: grid; grid-template-columns: 18rem minmax(0, 1fr); max-width: 1200px; margin: auto; }
.tree { position: sticky; top: 0; height:100vh; overflow:auto; padding:1rem; border-right:1px solid color-mix(in srgb, currentColor 20%, transparent); }
.content { min-width:0; padding:2rem; }
.tree ul { padding-left: 1.2rem; }
.tree .active { font-weight: bold; }
.browse { display: none; }
@media (max-width: 700px) {
  .layout { display: flex; flex-direction: column; }
  .content { order: 1; }
  .tree { display: none; order: 2; position: static; height: auto; }
  .tree[data-open="true"] { display: block; }
  .browse { display: block; }
}`;
