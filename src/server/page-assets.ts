import { createHash } from "node:crypto";
import { codeToolbarClient } from "./code-toolbar-client.ts";
import { directoryTableClient } from "./directory-table-client.ts";
import { displayControlsClient } from "./display-controls-client.ts";
import { markdownTocClient } from "./markdown-toc-client.ts";
import { pageClient } from "./page-client.ts";
import { relativeTimeClient } from "./relative-time-client.ts";
import { viewTransitionClient } from "./view-transition-client.ts";
import { pageCss } from "./page-css.ts";

type PageAsset = { body: string; contentType: string; url: string };

const assetPath = "/__markdown_serve__/assets/";
const versioned = (
  name: string,
  body: string,
  contentType: string,
): PageAsset => ({
  body,
  contentType,
  url: `${assetPath}${name}-${contentHash(body)}.${
    name === "page" ? "css" : "js"
  }`,
});

export const pageStylesheet = versioned(
  "page",
  pageCss,
  "text/css; charset=UTF-8",
);
export const pageScript = versioned(
  "client",
  `${viewTransitionClient}${displayControlsClient}${directoryTableClient}${relativeTimeClient}${pageClient}${markdownTocClient}${codeToolbarClient}`,
  "text/javascript; charset=UTF-8",
);

export function pageAsset(pathname: string): PageAsset | undefined {
  return [pageStylesheet, pageScript].find((asset) => asset.url === pathname);
}

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
