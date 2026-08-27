import type { ReloadSource } from "./reload-source.ts";
import type { FinderRunner } from "./file-search.ts";

export type ErrorHandler = (error: unknown) => Response | Promise<Response>;

export type HandlerOptions = {
  root: string;
  redirectStatus?: 301 | 302;
  onError?: ErrorHandler;
  reloadSource?: ReloadSource;
  git?: boolean;
  finders?: ("fd" | "fdfind")[];
  finderRunner?: FinderRunner;
};

export type ServerOptions = HandlerOptions & {
  hostname?: string;
  port?: number;
  signal?: AbortSignal;
  onListen?: (address: Deno.NetAddr) => void;
  liveReload?: boolean;
  liveReloadIgnorePaths?: string[];
};

export type RequestHandler = (request: Request) => Promise<Response>;
