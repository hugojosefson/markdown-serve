import { queryHref, retainQuery, setQuery } from "./query.ts";

export type HeaderAction =
  | {
    kind: "files";
    href: string;
    label: "Files";
    queryScope: "directory";
    title: string;
  }
  | {
    kind: "index";
    href: string;
    label: string;
    title: string;
    queryRemove: ["dir"];
  };

export type FileAction =
  | { kind: "raw"; href: string; label: "Raw"; title: string }
  | { kind: "download"; href: string; label: "Download"; title: string }
  | {
    kind: "page";
    href: string;
    label: "View page";
    title: "Open HTML page preview";
    target: "_blank";
  };

export function rawPageAction(contentType: string): FileAction {
  return {
    kind: "raw",
    href: "?raw",
    label: "Raw",
    title: `View raw content (${contentType})`,
  };
}

export function markdownViewHref(
  url: URL,
  view: "rendered" | "source" | "edit",
): string {
  const query = retainQuery(
    url.search,
    view === "edit" ? ["theme", "wide"] : ["metadata", "theme", "wide"],
  );
  const withoutViews = setQuery(
    setQuery(query, "source", undefined),
    "edit",
    undefined,
  );
  return queryHref(
    url.pathname,
    view === "source"
      ? setQuery(withoutViews, "source", null)
      : view === "edit"
      ? setQuery(withoutViews, "edit", null)
      : withoutViews,
  );
}

export function savedEditHref(url: URL): string {
  const query = setQuery(
    retainQuery(url.search, ["edit", "theme", "wide"]),
    "saved",
    null,
  );
  return queryHref(url.pathname, query);
}

export function filePageActions(
  rawContentType: string,
  downloadContentType: string,
): FileAction[] {
  return [rawPageAction(rawContentType), {
    kind: "download",
    href: "?download",
    label: "Download",
    title: `Download file (${downloadContentType})`,
  }];
}

export function filesPageAction(url: URL): HeaderAction {
  return {
    kind: "files",
    href: queryHref(
      url.pathname,
      setQuery(retainQuery(url.search, ["theme", "wide"]), "dir", null),
    ),
    label: "Files",
    queryScope: "directory",
    title: "Browse directory files",
  };
}

export function indexPageAction(url: URL, index: string): HeaderAction {
  return {
    kind: "index",
    href: queryHref(
      url.pathname,
      retainQuery(url.search, ["theme", "wide"]),
    ),
    label: index,
    queryRemove: ["dir"],
    title: `View ${index}`,
  };
}

export function htmlPageAction(parts: string[]): FileAction {
  return {
    kind: "page",
    href: `/__markdown_serve__/site/${parts.map(encodeURIComponent).join("/")}`,
    label: "View page",
    title: "Open HTML page preview",
    target: "_blank",
  };
}
