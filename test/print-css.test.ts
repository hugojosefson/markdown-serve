import { assertMatch, assertNotMatch } from "@std/assert";
import { pageStylesheet } from "../src/server/page-assets.ts";
import { printCss } from "../src/server/print-css.ts";

Deno.test("print styles retain document content and remove application UI", () => {
  assertMatch(printCss, /@media print/);
  assertMatch(pageStylesheet.body, /@media print/);
  const hiddenUi =
    printCss.match(/\.tree,[\s\S]*?display: none !important;/)?.[0] ?? "";
  for (
    const selector of [
      ".tree",
      ".content-header",
      ".markdown-toc",
      ".file-metadata-details",
      ".code-toolbar",
      ".anchor",
      "dialog",
    ]
  ) {
    assertMatch(hiddenUi, new RegExp(selector.replace(".", "\\.")));
  }
  assertNotMatch(printCss, /\.directory-scroll[^}]*display: none/);
  assertMatch(
    printCss,
    /\.layout \{ display: block; margin: 0; max-width: none; padding: 0; \}/,
  );
});

Deno.test("print styles use paper-safe colors for document elements", () => {
  assertMatch(
    printCss,
    /:root \{ color-scheme: light !important; \}/,
  );
  assertMatch(
    printCss,
    /html \{ background: #fff !important; scrollbar-gutter: auto !important; \}/,
  );
  assertMatch(
    printCss,
    /body \{ background: #fff !important; color: #111 !important; margin: 0; \}/,
  );
  assertMatch(
    printCss,
    /\.markdown-body, \.markdown-body \* \{ background: transparent !important; box-shadow: none !important; color: #111 !important; outline: none !important; \}/,
  );
  assertMatch(
    printCss,
    /\.markdown-body a \{ color: #111 !important; text-decoration: underline; \}/,
  );
});

Deno.test("print styles prevent clipping and poor page breaks", () => {
  assertMatch(
    printCss,
    /\.markdown-body table \{ display: table; max-width: 100%; overflow: visible; width: 100%; \}/,
  );
  assertMatch(
    printCss,
    /\.source-line \{ display: block !important; min-width: 0; \}/,
  );
  assertMatch(
    printCss,
    /\.source-line-content \{ overflow-wrap: anywhere; white-space: pre-wrap !important; \}/,
  );
  assertMatch(
    printCss,
    /\.directory-scroll \{ max-width: none; overflow: visible !important; width: auto; \}/,
  );
  assertMatch(
    printCss,
    /\.markdown-body :is\(h1, h2, h3, h4, h5, h6\) \{ break-after: avoid; page-break-after: avoid; \}/,
  );
  assertMatch(
    printCss,
    /\.markdown-body tr, \.markdown-body img \{ break-inside: avoid; page-break-inside: avoid; \}/,
  );
});
