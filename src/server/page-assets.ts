import { createHash } from "node:crypto";
import { codeToolbarClient } from "./code-toolbar-client.ts";
import { directoryTableClient } from "./directory-table-client.ts";
import { displayControlsBehaviorClient } from "./display-controls-client.ts";
import { markdownTocClient } from "./markdown-toc-client.ts";
import { pageClient } from "./page-client.ts";
import { relativeTimeClient } from "./relative-time-client.ts";
import { viewTransitionClient } from "./view-transition-client.ts";
import { fileSearchClient } from "./file-search-client.ts";
import { contentSearchClient } from "./content-search-client.ts";
import { editClient } from "./edit-client.ts";
import { editorRouteClient } from "./editor-route-client.ts";
import { dialogDismissalClient } from "./dialog-dismissal-client.ts";
import { pageCss } from "./page-css.ts";
import { clientLifecycle } from "./client-lifecycle.ts";
import { reloadClient } from "./reload-client.ts";
import { navigationQueryClient } from "./client-query.ts";
import turboSource from "@hotwired/turbo/dist/turbo.es2017-umd.js" with {
  type: "text",
};

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
  `${clientLifecycle}${viewTransitionClient}${navigationQueryClient}${dialogDismissalClient}${reloadClient}${
    pageInitializer(displayControlsBehaviorClient)
  }${
    pageInitializer(
      directoryTableClient,
      "directoryTableObserver?.disconnect?.();",
    )
  }${pageInitializer(relativeTimeClient, "clearTimeout(relativeTimeTimer);")}${
    pageInitializer(pageClient)
  }${pageInitializer(markdownTocClient)}${pageInitializer(codeToolbarClient)}${
    pageInitializer(fileSearchClient)
  }${pageInitializer(contentSearchClient)}${pageInitializer(editClient)}${
    pageInitializer(editorRouteClient)
  }`,
  "text/javascript; charset=UTF-8",
);
export const turboScript = versioned(
  "turbo",
  turboSource,
  "text/javascript; charset=UTF-8",
);

export function pageAsset(pathname: string): PageAsset | undefined {
  return [pageStylesheet, turboScript, pageScript].find((asset) =>
    asset.url === pathname
  );
}

function pageInitializer(source: string, cleanup = ""): string {
  return `registerPageInitializer(() => {${source}${
    cleanup ? `return () => {${cleanup}};` : ""
  }});`;
}

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
