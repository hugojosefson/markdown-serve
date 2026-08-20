import { queryHref, setQuery } from "./query.ts";

export type PageAction =
  | { kind: "raw"; href: string; label: "Raw"; title: string }
  | { kind: "download"; href: string; label: "Download"; title: string }
  | { kind: "files"; href: string; label: "Files"; title: string }
  | {
    kind: "index";
    href: string;
    label: string;
    title: string;
    queryRemove: ["dir"];
  };

export function rawPageAction(contentType: string): PageAction {
  return {
    kind: "raw",
    href: "?raw",
    label: "Raw",
    title: `View raw content (${contentType})`,
  };
}

export function filePageActions(
  rawContentType: string,
  downloadContentType: string,
): PageAction[] {
  return [rawPageAction(rawContentType), {
    kind: "download",
    href: "?download",
    label: "Download",
    title: `Download file (${downloadContentType})`,
  }];
}

export function filesPageAction(url: URL): PageAction {
  return {
    kind: "files",
    href: queryHref(
      url.pathname,
      setQuery(setQuery(url.search, "raw", undefined), "dir", null),
    ),
    label: "Files",
    title: "Browse directory files",
  };
}

export function indexPageAction(url: URL, index: string): PageAction {
  return {
    kind: "index",
    href: queryHref(
      url.pathname,
      setQuery(setQuery(url.search, "dir", undefined), "raw", undefined),
    ),
    label: index,
    queryRemove: ["dir"],
    title: `View ${index}`,
  };
}
