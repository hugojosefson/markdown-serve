import { queryHref, setQuery } from "./query.ts";

export type HeaderAction =
  | { kind: "files"; href: string; label: "Files"; title: string }
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
  | { kind: "source"; href: string; label: "View source"; title: string }
  | {
    kind: "rendered";
    href: string;
    label: "View rendered";
    title: string;
    queryRemove: ["source"];
  }
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

export function markdownViewPageAction(url: URL, source: boolean): FileAction {
  if (source) {
    return {
      kind: "rendered",
      href: queryHref(url.pathname, setQuery(url.search, "source", undefined)),
      label: "View rendered",
      queryRemove: ["source"],
      title: "View rendered Markdown",
    };
  }
  return {
    kind: "source",
    href: queryHref(url.pathname, setQuery(url.search, "source", null)),
    label: "View source",
    title: "View Markdown source",
  };
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
      setQuery(setQuery(url.search, "raw", undefined), "dir", null),
    ),
    label: "Files",
    title: "Browse directory files",
  };
}

export function indexPageAction(url: URL, index: string): HeaderAction {
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

export function htmlPageAction(parts: string[]): FileAction {
  return {
    kind: "page",
    href: `/__markdown_server__/site/${
      parts.map(encodeURIComponent).join("/")
    }`,
    label: "View page",
    title: "Open HTML page preview",
    target: "_blank",
  };
}
