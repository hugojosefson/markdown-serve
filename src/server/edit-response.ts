import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative } from "@std/path";
import { filePath, splitPath } from "./paths.ts";
import { isTextFile, isUtf8Text } from "./text-file.ts";
import type { ServerConfig } from "./types.ts";

export const editLimit = 1024 * 1024;

export type EditFileSystem =
  & Pick<
    typeof Deno,
    | "lstat"
    | "realPath"
    | "readFile"
    | "stat"
    | "open"
    | "chmod"
    | "rename"
    | "remove"
  >
  & {
    /** Sync the containing directory after a rename, where the platform permits. */
    syncDirectory?(path: string): Promise<void>;
  };

export class EditConflict extends Error {}

/** Per-handler state; do not retain paths after their queued work finishes. */
export class EditCoordinator {
  #writes = new Map<string, Promise<void>>();
  constructor(readonly fs: EditFileSystem = Deno) {}
  async write(path: string, action: () => Promise<void>): Promise<void> {
    const previous = this.#writes.get(path) ?? Promise.resolve();
    let release!: () => void;
    const mine = new Promise<void>((resolve) => release = resolve);
    const queued = previous.then(() => mine);
    this.#writes.set(path, queued);
    await previous;
    try {
      await action();
    } finally {
      release();
      if (this.#writes.get(path) === queued) this.#writes.delete(path);
    }
  }
}

export async function editableFile(
  root: string,
  path: string,
): Promise<boolean> {
  try {
    const link = await Deno.lstat(path);
    if (!link.isFile || link.isSymlink || link.size > editLimit) return false;
    const realRoot = await Deno.realPath(root);
    const real = await Deno.realPath(path);
    const relation = relative(realRoot, real);
    if (isAbsolute(relation) || relation.split(/[\\/]+/).includes("..")) {
      return false;
    }
    if (!await isTextFile(path)) return false;
    return validText(await Deno.readFile(path));
  } catch {
    return false;
  }
}

export async function editResponse(
  config: ServerConfig,
  request: Request,
  url: URL,
): Promise<Response> {
  if (!config.edit) return new Response("Not Found", { status: 404 });
  if (
    ![
      "GET",
      "HEAD",
      "PUT",
    ].includes(request.method)
  ) {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, PUT" },
    });
  }
  const path = editablePath(config.rootPath, url.searchParams.get("path"));
  if (!path || !await editableFile(config.rootPath, path)) {
    return new Response("Not Found", { status: 404 });
  }
  if (request.method !== "PUT") return await readResponse(path, request.method);
  if (!sameOrigin(request, url)) {
    return new Response("Forbidden", { status: 403 });
  }
  const ifMatch = request.headers.get("if-match");
  if (ifMatch === null) {
    return new Response("Precondition Required", { status: 428 });
  }
  if (
    !/^text\/plain\s*;\s*charset=utf-8\s*$/i.test(
      request.headers.get("content-type") ?? "",
    )
  ) return new Response("Unsupported Media Type", { status: 415 });
  const body = await boundedBody(request);
  if (!body) return new Response("Payload Too Large", { status: 413 });
  if (!validText(body)) return new Response("Invalid UTF-8", { status: 400 });
  const coordinator = config.editCoordinator ?? new EditCoordinator();
  let result: Response = new Response("Not Found", { status: 404 });
  await coordinator.write(path, async () => {
    if (!await editableFile(config.rootPath, path)) return;
    const current = await Deno.readFile(path);
    if (ifMatch !== tag(current)) {
      result = new Response("Precondition Failed", { status: 412 });
      return;
    }
    try {
      await atomicReplace(path, body, coordinator.fs, tag(current));
    } catch (error) {
      if (error instanceof EditConflict) {
        result = new Response("Precondition Failed", { status: 412 });
        return;
      }
      throw error;
    }
    config.catalog.clear();
    config.symbols?.clear();
    result = new Response(null, {
      status: 204,
      headers: {
        ETag: tag(body),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
  return result;
}

function editablePath(root: string, value: string | null): string | undefined {
  if (!value) return undefined;
  const parts = splitPath(value);
  return parts?.length ? filePath(root, parts) : undefined;
}

async function readResponse(path: string, method: string): Promise<Response> {
  const bytes = await Deno.readFile(path);
  if (!validText(bytes)) return new Response("Not Found", { status: 404 });
  return new Response(method === "HEAD" ? null : bytes, {
    headers: {
      ETag: tag(bytes),
      "content-type": "text/plain; charset=UTF-8",
      "content-length": String(bytes.byteLength),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get("origin") === url.origin;
}

async function boundedBody(request: Request): Promise<Uint8Array | undefined> {
  const declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > editLimit)
  ) return undefined;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > editLimit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function validText(bytes: Uint8Array): boolean {
  return bytes.byteLength <= editLimit && isUtf8Text(bytes, false);
}
function tag(bytes: Uint8Array): string {
  return `"${createHash("sha256").update(bytes).digest("hex")}"`;
}

export async function atomicReplace(
  path: string,
  body: Uint8Array,
  fs: EditFileSystem = Deno,
  expectedTag?: string,
): Promise<void> {
  const info = await fs.stat(path);
  const mode = info.mode ?? undefined;
  const directory = dirname(path);
  const temp = join(directory, `.markdown-serve-${crypto.randomUUID()}.tmp`);
  try {
    const file = await fs.open(temp, {
      write: true,
      createNew: true,
      ...(mode === undefined ? {} : { mode }),
    });
    try {
      for (let offset = 0; offset < body.length;) {
        const written = await file.write(body.subarray(offset));
        if (!written) throw new Error("short write");
        offset += written;
      }
      await file.sync();
    } finally {
      file.close();
    }
    if (mode !== undefined) await fs.chmod(temp, mode);
    if (expectedTag !== undefined) {
      const current = await fs.lstat(path);
      if (
        !current.isFile || current.isSymlink ||
        tag(await fs.readFile(path)) !== expectedTag
      ) {
        throw new EditConflict("file changed during save");
      }
    }
    await fs.rename(temp, path);
    try {
      if (fs.syncDirectory) {
        await fs.syncDirectory(directory);
      } else if (fs === Deno) {
        const directoryFile = await Deno.open(directory);
        try {
          await directoryFile.sync();
        } finally {
          directoryFile.close();
        }
      }
    } catch {
      // Directory fsync is not supported by every filesystem or platform.
    }
  } finally {
    try {
      await fs.remove(temp);
    } catch { /* renamed or absent */ }
  }
}
