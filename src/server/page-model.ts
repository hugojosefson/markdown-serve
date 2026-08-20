import type { PageAction } from "./page-action.ts";

export type PageModel = {
  title: string;
  parts: string[];
  directory: boolean;
  content: string;
  url: URL;
  actions?: PageAction[];
  directoryView?: boolean;
  sourceName?: string;
};
