import type { ReloadSource } from "./reload-source.ts";
import type { HandlerOptions } from "./server-options.ts";

export type ServerConfig = {
  rootPath: string;
  rootLabel: string;
  redirectStatus: 301 | 302;
  onError?: HandlerOptions["onError"];
  reloadSource?: ReloadSource;
};
