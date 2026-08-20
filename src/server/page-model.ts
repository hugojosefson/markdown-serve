import type { FileAction, HeaderAction } from "./page-action.ts";
import type { FileMetadata } from "./file-metadata.ts";
import type { GitStatus } from "./git/status.ts";

export type PageModel = {
  title: string;
  parts: string[];
  directory: boolean;
  content: string;
  url: URL;
  headerActions?: HeaderAction[];
  fileActions?: FileAction[];
  fileActionPlacement?: "heading" | "toolbar" | "top";
  directoryView?: boolean;
  sourceName?: string;
  metadata?: FileMetadata;
  gitStatus?: GitStatus;
};
