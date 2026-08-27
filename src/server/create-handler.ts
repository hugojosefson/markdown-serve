import { resolve } from "@std/path";
import { internalResponse } from "./internal.ts";
import { FileCatalog } from "./file-catalog.ts";
import { route } from "./route.ts";
import { plain } from "./responses.ts";
import type { HandlerOptions, RequestHandler } from "./server-options.ts";
import type { ServerConfig } from "./types.ts";
import { createGitState } from "./git/state.ts";
import { SymbolCatalog } from "./symbols/catalog.ts";
import { EditCoordinator } from "./edit-response.ts";

export async function createRequestHandler(
  options: HandlerOptions,
): Promise<RequestHandler> {
  const rootPath = resolve(options.root);
  if (options.edit) {
    const permission = await Deno.permissions.query({
      name: "write",
      path: rootPath,
    });
    if (permission.state !== "granted") {
      throw new Error(
        `cannot write root ${rootPath}; grant --allow-write=${rootPath}`,
      );
    }
  }
  try {
    if (!(await Deno.stat(rootPath)).isDirectory) {
      throw new Error("not a directory");
    }
  } catch (error) {
    throw new Error(
      `cannot access root ${options.root}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const catalog = new FileCatalog();
  const symbols = new SymbolCatalog(rootPath);
  let warmRevision = 0;
  let warmQueue = Promise.resolve();
  const scheduleWarm = (clear: boolean): Promise<void> => {
    warmRevision++;
    if (clear) {
      catalog.clear();
      symbols.clear();
    }
    warmQueue = warmQueue.catch(() => {}).then(() =>
      catalog.warmRoot(rootPath)
    );
    return warmQueue;
  };
  let sourceClosed = false;
  let unsubscribe = () => {};
  unsubscribe = options.reloadSource?.subscribe(
    () => scheduleWarm(true),
    () => {
      sourceClosed = true;
      unsubscribe();
    },
  ) ?? unsubscribe;
  if (sourceClosed) {
    unsubscribe();
  }
  scheduleWarm(false);
  let observedRevision = 0;
  do {
    observedRevision = warmRevision;
    await warmQueue;
  } while (observedRevision !== warmRevision);
  const config: ServerConfig = {
    rootPath,
    rootLabel: ensureEndsWithSlash(options.root),
    redirectStatus: options.redirectStatus ?? 302,
    onError: options.onError,
    reloadSource: options.reloadSource,
    catalog,
    symbols,
    git: options.git === false
      ? undefined
      : await createGitState(rootPath, options.reloadSource),
    finders: options.finders,
    finderRunner: options.finderRunner,
    contentSearchRunner: options.contentSearchRunner,
    edit: options.edit ?? false,
    editCoordinator: options.edit
      ? options.editCoordinator ?? new EditCoordinator()
      : undefined,
  };
  return async (request) => await respond(config, request);
}

export function ensureEndsWithSlash(rootDirArg: string): string {
  return rootDirArg.endsWith("/") ? rootDirArg : `${rootDirArg}/`;
}

async function respond(
  config: ServerConfig,
  request: Request,
): Promise<Response> {
  try {
    return new URL(request.url).pathname.startsWith("/__markdown_serve__/")
      ? await internalResponse(config, request)
      : await route(config, request);
  } catch (error) {
    return config.onError
      ? await config.onError(error)
      : plain("Internal Server Error", 500, request.method);
  }
}
