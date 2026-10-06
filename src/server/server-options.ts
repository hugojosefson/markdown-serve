import type { ReloadSource } from "./reload-source.ts";
import type { FinderRunner } from "./file-search.ts";
import type { ContentSearchRunner } from "./content-search.ts";
import type { EditCoordinator } from "./edit-response.ts";

export type ErrorHandler = (error: unknown) => Response | Promise<Response>;

export type HandlerOptions = {
  root: string;
  redirectStatus?: 301 | 302;
  onError?: ErrorHandler;
  warn?: (message: string) => void;
  reloadSource?: ReloadSource;
  git?: boolean;
  finders?: ("fd" | "fdfind")[];
  finderRunner?: FinderRunner;
  contentSearchRunner?: ContentSearchRunner;
  /** Enables the internal, same-origin guarded text editor. */
  edit?: boolean;
  /** Coordinates editor writes; primarily useful for embedding and tests. */
  editCoordinator?: EditCoordinator;
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
