import type { DirectoryEntry } from "./fs.ts";

export type EntryKind =
  | "directory"
  | "symlink"
  | "executable"
  | "archive"
  | "image"
  | "media"
  | "file";

export function entryKind(entry: DirectoryEntry): EntryKind {
  if (entry.symlink) return "symlink";
  if (entry.directory) return "directory";
  if (entry.info && (entry.info.mode ?? 0) & 0o111) return "executable";
  const extension = entry.name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  if (
    [".zip", ".gz", ".bz2", ".xz", ".tar", ".7z", ".rar"].includes(extension)
  ) return "archive";
  if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".ico"]
      .includes(extension)
  ) return "image";
  if (
    [".mp3", ".wav", ".ogg", ".flac", ".m4a", ".mp4", ".webm", ".mov", ".mkv"]
      .includes(extension)
  ) return "media";
  return "file";
}
