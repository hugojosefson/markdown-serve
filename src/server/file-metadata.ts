import { contentType } from "@std/media-types";
import { basename } from "@std/path";
import { escapeHtml } from "./html.ts";
import { queryHref, setQuery } from "./query.ts";
import { renderIsoTimestamp } from "./render-iso-timestamp.ts";

export type FileMetadata = {
  mime: string;
  size: number;
  modified?: Date;
  mode?: number;
  permissions?: string;
  uid?: number;
};

export function fileMime(path: string): string {
  const name = basename(path);
  const dot = name.lastIndexOf(".");
  const extension = dot < 0 ? "" : name.slice(dot).toLowerCase();
  if (extension === ".ts" || extension === ".mts") {
    return "text/plain; charset=UTF-8";
  }
  return contentType(extension) ??
    "application/octet-stream";
}

export function textFileMime(path: string): string {
  const mime = fileMime(path);
  return mime.startsWith("text/") || mime.includes("json") ||
      mime.includes("xml") || mime.includes("javascript")
    ? mime
    : "text/plain; charset=UTF-8";
}

export function previewableFile(path: string): boolean {
  const mime = fileMime(path);
  return mime.startsWith("image/") || mime.startsWith("audio/") ||
    mime.startsWith("video/") || mime === "application/pdf";
}

export function metadataForFile(
  path: string,
  info: Deno.FileInfo,
): FileMetadata {
  return {
    mime: fileMime(path),
    size: info.size,
    modified: info.mtime ?? undefined,
    mode: info.mode ?? undefined,
    permissions: permissions(info),
    uid: info.uid ?? undefined,
  };
}

export function formatSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const formatted = value < 10 && unit
    ? value.toFixed(1).replace(/\.0$/, "")
    : Math.round(value);
  return `${formatted} ${units[unit]}`;
}

export function permissions(
  info: Deno.FileInfo | undefined,
): string | undefined {
  if (!info || info.mode === null) return undefined;
  const bit = (value: number, character: string) =>
    info.mode! & value ? character : "-";
  return `${info.isDirectory ? "d" : "-"}${bit(0o400, "r")}${bit(0o200, "w")}${
    bit(0o100, "x")
  }${bit(0o040, "r")}${bit(0o020, "w")}${bit(0o010, "x")}${bit(0o004, "r")}${
    bit(0o002, "w")
  }${bit(0o001, "x")}`;
}

export function renderFileMetadataSummary(
  metadata: FileMetadata,
  url: URL,
  expanded: boolean,
): string {
  const relative = metadata.modified
    ? formatRelativeTime(metadata.modified)
    : "modified time unavailable";
  const href = queryHref(
    url.pathname,
    setQuery(url.search, "metadata", expanded ? undefined : "expand"),
  );
  const action = expanded ? "Collapse metadata" : "Expand metadata";
  return `<a class="file-metadata" href="${
    escapeHtml(href)
  }" title="${action}" aria-label="${action}" aria-controls="file-metadata-details" aria-expanded="${expanded}">${
    [formatSize(metadata.size), relative].map(escapeHtml).join(
      ' <span aria-hidden="true">·</span> ',
    )
  }</a>`;
}

export function renderFileMetadataDetails(
  metadata: FileMetadata,
  url: URL,
): string {
  const fields: MetadataField[] = [
    {
      label: "Modified",
      value: metadata.modified
        ? renderIsoTimestamp(metadata.modified)
        : undefined,
      valueIsHtml: true,
      suffix: metadata.modified
        ? `(${formatRelativeTime(metadata.modified)})`
        : undefined,
    },
    {
      label: "Size",
      value: `${metadata.size} bytes (${formatSize(metadata.size)})`,
    },
    { label: "Media type", value: metadata.mime },
    {
      label: "User",
      value: metadata.uid === undefined ? undefined : String(metadata.uid),
    },
    { label: "Permissions", value: metadata.permissions },
    {
      label: "Mode",
      value: metadata.mode === undefined
        ? undefined
        : metadata.mode.toString(8),
    },
  ];
  const rows = fields
    .filter((field): field is MetadataField & { value: string } =>
      field.value !== undefined
    )
    .map(({ label, value, valueIsHtml, suffix }) =>
      `<div><dt>${escapeHtml(label)}</dt><dd>${
        valueIsHtml ? value : escapeHtml(value)
      }${
        suffix
          ? `<wbr> <span class="metadata-value-suffix">${
            escapeHtml(suffix)
          }</span>`
          : ""
      }</dd></div>`
    ).join("");
  const closeHref = queryHref(
    url.pathname,
    setQuery(url.search, "metadata", undefined),
  );
  return `<section class="file-metadata-details" id="file-metadata-details" aria-label="File metadata"><div class="file-metadata-details-header"><span>File metadata</span><a class="file-metadata-close" href="${
    escapeHtml(closeHref)
  }" title="Collapse metadata" aria-label="Collapse metadata"><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8"/></svg></a></div><dl>${rows}</dl></section>`;
}

type MetadataField = {
  label: string;
  value: string | undefined;
  valueIsHtml?: boolean;
  suffix?: string;
};

function formatRelativeTime(date: Date, now = new Date()): string {
  const ranges: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
    [4.345, "week"],
    [12, "month"],
    [Number.POSITIVE_INFINITY, "year"],
  ];
  let value = (date.getTime() - now.getTime()) / 1_000;
  for (const [range, unit] of ranges) {
    if (Math.abs(value) < range) {
      return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
        Math.round(value),
        unit,
      );
    }
    value /= range;
  }
  return "now";
}
