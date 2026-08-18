import type { ReloadSource } from "./reload-source.ts";

export type HandlerOptions = {
  root: string;
  redirectStatus?: 301 | 302;
  onError?: (error: unknown) => Response | Promise<Response>;
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
