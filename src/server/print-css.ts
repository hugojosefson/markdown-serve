export const printCss = `
@media print {
  @page { margin: 1.5cm; }
  :root { color-scheme: light !important; }
  html { background: #fff !important; scrollbar-gutter: auto !important; }
  body { background: #fff !important; color: #111 !important; margin: 0; }
  .markdown-body { background: #fff !important; color: #111 !important; }
  .markdown-body, .markdown-body * { background: transparent !important; box-shadow: none !important; color: #111 !important; outline: none !important; }
  .layout { display: block; margin: 0; max-width: none; padding: 0; }
  .content { max-width: none; padding: 0; }
  .page-content-top { padding-top: 0; }
  .tree, .content-header, .repo-context, .markdown-toc, .file-metadata-details, .file-actions, .code-toolbar, .anchor, dialog, .content-search, .go-to-file { display: none !important; }
  dialog::backdrop { background: transparent !important; }
  .markdown-body a { color: #111 !important; text-decoration: underline; }
  .markdown-body pre, .markdown-body code { border-color: #999 !important; color: #111 !important; overflow: visible !important; overflow-wrap: anywhere; white-space: pre-wrap !important; }
  .code-block, .markdown-source-panel, .code-block > .highlight { overflow: visible !important; }
  .source-line { display: block !important; min-width: 0; }
  .source-line-number, .source-symbol-marker, .source-line-deletions { display: none !important; }
  .source-line-content { overflow-wrap: anywhere; white-space: pre-wrap !important; }
  .directory-scroll { max-width: none; overflow: visible !important; width: auto; }
  .directory-table { min-width: 0; table-layout: fixed; width: 100%; }
  .markdown-body table { display: table; max-width: 100%; overflow: visible; width: 100%; }
  .markdown-body table, .markdown-body th, .markdown-body td { border-color: #777 !important; }
  .markdown-body th, .markdown-body td, .directory-table th, .directory-table td { overflow-wrap: anywhere; white-space: normal; }
  .markdown-body tr, .markdown-body tr:nth-child(2n) { background: #fff !important; }
  .markdown-body th { background: #f0f0f0 !important; color: #111 !important; }
  .markdown-body :is(h1, h2, h3, h4, h5, h6) { break-after: avoid; page-break-after: avoid; }
  .markdown-body tr, .markdown-body img { break-inside: avoid; page-break-inside: avoid; }
}
`;
