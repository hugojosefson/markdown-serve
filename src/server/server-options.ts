import type { ReloadSource } from "./reload-source.ts";

export type ErrorHandler = (error: unknown) => Response | Promise<Response>;

export type HandlerOptions = {
  root: string;
  redirectStatus?: 301 | 302;
  onError?: ErrorHandler;
  reloadSource?: ReloadSource;
};

export type ServerOptions = HandlerOptions & {
  hostname?: string;
  port?: number;
  signal?: AbortSignal;
  onListen?: (address: Deno.NetAddr) => void;
  liveReload?: boolean;
};

export type RequestHandler = (request: Request) => Promise<Response>;
