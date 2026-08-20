import { createRequestHandler } from "./server/create-handler.ts";
import { createReloadWatcher } from "./server/reload.ts";
import type {
  HandlerOptions,
  RequestHandler,
  ServerOptions,
} from "./server/server-options.ts";

export type {
  HandlerOptions,
  RequestHandler,
  ServerOptions,
} from "./server/server-options.ts";
export type { ReloadSource } from "./server/reload-source.ts";

export async function createHandler(
  options: HandlerOptions,
): Promise<RequestHandler> {
  return await createRequestHandler(options);
}

/** Binds exactly `port`, or 8000 when omitted. */
export async function serve(options: ServerOptions): Promise<Deno.HttpServer> {
  const watched = options.liveReload && !options.reloadSource
    ? createReloadWatcher(
      options.root,
      options.signal,
      options.liveReloadIgnorePaths,
    )
    : undefined;
  try {
    const server = Deno.serve(
      {
        hostname: options.hostname ?? "localhost",
        port: options.port ?? 8000,
        signal: options.signal,
        onListen: options.onListen,
      },
      await createHandler({
        root: options.root,
        redirectStatus: options.redirectStatus,
        onError: options.onError,
        reloadSource: options.reloadSource ?? watched,
      }),
    );
    if (watched) {
      void server.finished.then(() => watched.close(), () => watched.close());
    }
    return server;
  } catch (error) {
    watched?.close();
    throw error;
  }
}
