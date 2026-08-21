import { assertMatch } from "@std/assert";
import { pageStylesheet } from "../src/server/page-assets.ts";

Deno.test("page CSS opts into cross-document transitions only when motion is allowed", () => {
  assertMatch(
    pageStylesheet.body,
    /@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /::view-transition-group\(root\), ::view-transition-old\(root\), ::view-transition-new\(root\) \{ animation-duration: 120ms; animation-timing-function: ease-out; \}/,
  );
});

Deno.test("metadata expansion separates moving content and details", () => {
  assertMatch(
    pageStylesheet.body,
    /\.content-header \.file-metadata \{ view-transition-name: file-metadata; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /\.content:has\(\.file-metadata\) \.page-content \{ view-transition-name: file-content; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /\.file-metadata-details \{ view-transition-name: file-metadata-details; \}/,
  );
  assertMatch(
    pageStylesheet.body,
    /::view-transition-new\(file-metadata-details\):only-child \{ animation: 140ms ease-out both metadata-details-in; transform-origin: top; \}/,
  );
});
