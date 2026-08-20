import type { ReloadSource } from "./reload-source.ts";
import type { FileCatalog } from "./file-catalog.ts";
import type { ErrorHandler } from "./server-options.ts";

export type ServerConfig = {
  rootPath: string;
  rootLabel: string;
  redirectStatus: 301 | 302;
  onError?: ErrorHandler;
  reloadSource?: ReloadSource;
  catalog: FileCatalog;
};
