import { serve } from "../server.ts";
import { packageSourcePaths } from "./package-source-paths.ts";
import type { CliOptions } from "./types.ts";

export async function startServer(
  options: CliOptions,
  signal?: AbortSignal,
  git = false,
): Promise<Deno.HttpServer> {
  return await serveAt(options, options.port, signal, git);
}

async function serveAt(
  options: CliOptions,
  port: number,
  signal?: AbortSignal,
  git = false,
): Promise<Deno.HttpServer> {
  try {
    return await serve({
      root: options.root,
      hostname: options.host,
      port,
      redirectStatus: options.redirectStatus,
      liveReload: options.reload,
      liveReloadIgnorePaths: ignoredPackageSourcePaths,
      git,
      signal,
      onListen: () => {},
    });
  } catch (error) {
    if (options.explicitPort || !isAddressInUse(error) || port === 65535) {
      throw error;
    }
    return await serveAt(options, port + 1, signal, git);
  }
}

const ignoredPackageSourcePaths = packageSourcePaths(import.meta.url);

function isAddressInUse(error: unknown): boolean {
  return error instanceof Deno.errors.AddrInUse ||
    (error instanceof Error &&
      error.message.includes("Address already in use"));
}
