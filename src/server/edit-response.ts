import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, relative } from "@std/path";
import { codeLanguageForPath } from "./code-language.ts";
import { draftDiff } from "./draft-diff.ts";
import { filePath, splitPath } from "./paths.ts";
import {
  renderCodeMarkdown,
  renderHighlightedCode,
} from "./render-code-markdown.ts";
import { isTextFile, isUtf8Text } from "./text-file.ts";
import type { ServerConfig } from "./types.ts";
import type { FileAccess } from "./file-access.ts";
import { gitStateAt } from "./git/resolver.ts";

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
  access?: FileAccess,
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
  } catch (error) {
    access?.handlePermissionDenied(path, error);
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
  if (
    !path || config.access?.isDenied(path) ||
    !await editableFile(config.rootPath, path, config.access)
  ) {
    if (path && config.access?.isDenied(path)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Not Found", { status: 404 });
  }
  if (request.method !== "PUT") {
    try {
      return await readResponse(path, request.method);
    } catch (error) {
      if (config.access?.handlePermissionDenied(path, error)) {
        return new Response("Forbidden", { status: 403 });
      }
      throw error;
    }
  }
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
  if (!validText(body)) {
    return new Response("Invalid UTF-8", { status: 400 });
  }
  const coordinator = config.editCoordinator ?? new EditCoordinator();
  let result: Response = new Response("Not Found", { status: 404 });
  await coordinator.write(path, async () => {
    if (!await editableFile(config.rootPath, path, config.access)) return;
    let current: Uint8Array;
    try {
      current = await Deno.readFile(path);
    } catch (error) {
      if (config.access?.handlePermissionDenied(path, error)) {
        result = new Response("Forbidden", { status: 403 });
        return;
      }
      throw error;
    }
    if (ifMatch !== editTag(current)) {
      result = new Response("Precondition Failed", { status: 412 });
      return;
    }
    try {
      await atomicReplace(path, body, coordinator.fs, editTag(current));
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
        ETag: editTag(body),
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });
  return result;
}

/** Same-origin, bounded progressive enhancement endpoint; it never writes. */
export async function editHighlightResponse(
  config: ServerConfig,
  request: Request,
  url: URL,
): Promise<Response> {
  if (!config.edit) {
    return new Response("Not Found", { status: 404 });
  }
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }
  if (!sameOrigin(request, url)) {
    return new Response("Forbidden", { status: 403 });
  }
  if (
    !/^text\/plain\s*;\s*charset=utf-8\s*$/i.test(
      request.headers.get("content-type") ?? "",
    )
  ) {
    return new Response("Unsupported Media Type", { status: 415 });
  }
  const path = editablePath(config.rootPath, url.searchParams.get("path"));
  if (
    !path || config.access?.isDenied(path) ||
    !await editableFile(config.rootPath, path, config.access)
  ) {
    if (path && config.access?.isDenied(path)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Not Found", { status: 404 });
  }
  const body = await boundedBody(request);
  if (!body) {
    return new Response("Payload Too Large", { status: 413 });
  }
  if (!validText(body)) {
    return new Response("Invalid UTF-8", { status: 400 });
  }
  const text = new TextDecoder().decode(body);
  const gitPath = relative(config.rootPath, path).replaceAll("\\", "/");
  const git = gitPath ? await gitStateAt(config, dirname(path)) : undefined;
  const head = gitPath ? await git?.head(gitPath) : undefined;
  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }
  const rawRevert = url.searchParams.get("revert");
  const revert = rawRevert === null ? undefined : Number(rawRevert);
  if (
    rawRevert !== null &&
    (!/^\d+$/.test(rawRevert) || !Number.isSafeInteger(revert))
  ) {
    return new Response("Bad Request", { status: 400 });
  }
  const diff = head === undefined
    ? { draft: text, hunks: [], limited: false }
    : draftDiff(head, text, revert);
  if (!diff) {
    return new Response("Conflict", { status: 409 });
  }
  const language = codeLanguageForPath(path, diff.draft);
  return Response.json({
    html: renderHighlightedCode(diff.draft, language),
    preview: language === "markdown"
      ? renderCodeMarkdown(diff.draft, editPreviewBase(url, gitPath))
      : undefined,
    ...diff,
    git: head !== undefined,
  }, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function editPreviewBase(url: URL, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return new URL(`/${encoded}`, url.origin).href;
}

export function editablePath(
  root: string,
  value: string | null,
): string | undefined {
  if (!value) return undefined;
  const parts = splitPath(value);
  return parts?.length ? filePath(root, parts) : undefined;
}

async function readResponse(path: string, method: string): Promise<Response> {
  const bytes = await Deno.readFile(path);
  if (!validText(bytes)) return new Response("Not Found", { status: 404 });
  return new Response(method === "HEAD" ? null : bytes, {
    headers: {
      ETag: editTag(bytes),
      "content-type": "text/plain; charset=UTF-8",
      "content-length": String(bytes.byteLength),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get("origin") === url.origin;
}

export async function boundedBody(
  request: Request,
  limit = editLimit,
): Promise<Uint8Array | undefined> {
  const declared = request.headers.get("content-length");
  if (
    declared !== null &&
    (!/^\d+$/.test(declared) || Number(declared) > limit)
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
      if (size > limit) {
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

export function validText(bytes: Uint8Array): boolean {
  return bytes.byteLength <= editLimit && isUtf8Text(bytes, false);
}
export function editTag(bytes: Uint8Array): string {
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
        editTag(await fs.readFile(path)) !== expectedTag
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

export type FormEditResult =
  | { kind: "saved" }
  | { kind: "conflict"; text: string; tag: string; currentText: string }
  | { kind: "invalid"; status: number; message: string };

/** Handles the deliberately narrow, no-JavaScript editor form protocol. */
export async function formEdit(
  config: ServerConfig,
  request: Request,
  url: URL,
  path: string,
): Promise<FormEditResult> {
  if (!sameOrigin(request, url)) {
    return { kind: "invalid", status: 403, message: "Forbidden" };
  }
  if (
    !/^application\/x-www-form-urlencoded(?:\s*;\s*charset=utf-8)?\s*$/i.test(
      request.headers.get("content-type") ?? "",
    )
  ) {
    return { kind: "invalid", status: 415, message: "Unsupported Media Type" };
  }
  const encoded = await boundedBody(request, editLimit * 3 + 1024);
  if (!encoded) {
    return { kind: "invalid", status: 413, message: "Payload Too Large" };
  }
  const form = parseForm(encoded);
  if (!form) {
    return { kind: "invalid", status: 400, message: "Invalid form" };
  }
  const etag = form.get("etag");
  const content = form.get("content");
  if (!etag || content === undefined || !/^"[0-9a-f]{64}"$/.test(etag)) {
    return { kind: "invalid", status: 400, message: "Invalid form" };
  }
  const submitted = new TextEncoder().encode(content);
  if (!validText(submitted)) {
    return {
      kind: "invalid",
      status: submitted.byteLength > editLimit ? 413 : 400,
      message: submitted.byteLength > editLimit
        ? "Payload Too Large"
        : "Invalid UTF-8",
    };
  }
  if (!await editableFile(config.rootPath, path, config.access)) {
    return config.access?.isDenied(path)
      ? { kind: "invalid", status: 403, message: "Forbidden" }
      : { kind: "invalid", status: 404, message: "Not Found" };
  }
  const coordinator = config.editCoordinator ?? new EditCoordinator();
  let result: FormEditResult = {
    kind: "invalid",
    status: 404,
    message: "Not Found",
  };
  await coordinator.write(path, async () => {
    if (!await editableFile(config.rootPath, path, config.access)) return;
    let current: Uint8Array;
    try {
      current = await Deno.readFile(path);
    } catch (error) {
      if (config.access?.handlePermissionDenied(path, error)) {
        result = { kind: "invalid", status: 403, message: "Forbidden" };
        return;
      }
      throw error;
    }
    const currentText = new TextDecoder().decode(current);
    if (etag !== editTag(current)) {
      result = {
        kind: "conflict",
        text: content,
        tag: editTag(current),
        currentText,
      };
      return;
    }
    const body = encodeSubmitted(content, current, currentText);
    if (!validText(body)) {
      result = {
        kind: "invalid",
        status: body.byteLength > editLimit ? 413 : 400,
        message: body.byteLength > editLimit
          ? "Payload Too Large"
          : "Invalid UTF-8",
      };
      return;
    }
    try {
      await atomicReplace(path, body, coordinator.fs, editTag(current));
    } catch (error) {
      if (!(error instanceof EditConflict)) {
        throw error;
      }
      if (!await editableFile(config.rootPath, path)) {
        result = { kind: "invalid", status: 404, message: "Not Found" };
        return;
      }
      let latest: Uint8Array;
      try {
        latest = await Deno.readFile(path);
      } catch {
        result = { kind: "invalid", status: 404, message: "Not Found" };
        return;
      }
      result = {
        kind: "conflict",
        text: content,
        tag: editTag(latest),
        currentText: new TextDecoder().decode(latest),
      };
      return;
    }
    config.catalog.clear();
    config.symbols?.clear();
    result = { kind: "saved" };
  });
  return result;
}

function parseForm(bytes: Uint8Array): Map<string, string> | undefined {
  let encoded: string;
  try {
    encoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
  const fields = new Map<string, string>();
  try {
    for (const pair of encoded.split("&")) {
      if (!pair) {
        continue;
      }
      const equals = pair.indexOf("=");
      const key = decodeForm(equals < 0 ? pair : pair.slice(0, equals));
      const value = decodeForm(equals < 0 ? "" : pair.slice(equals + 1));
      if ((key !== "etag" && key !== "content") || fields.has(key)) {
        return undefined;
      }
      fields.set(key, value);
    }
  } catch {
    return undefined;
  }
  return fields.size === 2 ? fields : undefined;
}

function decodeForm(value: string): string {
  return decodeURIComponent(value.replaceAll("+", " "));
}

function encodeSubmitted(
  content: string,
  current: Uint8Array,
  currentText: string,
): Uint8Array {
  const withoutCrlf = currentText.replaceAll("\r\n", "");
  const lineEnding = currentText.includes("\r\n") &&
      !withoutCrlf.includes("\r") && !withoutCrlf.includes("\n")
    ? "\r\n"
    : !currentText.includes("\r")
    ? "\n"
    : undefined;
  const normalized = lineEnding
    ? content.replace(/\r\n|\r|\n/g, lineEnding)
    : content;
  const body = new TextEncoder().encode(normalized);
  const bom = current.length >= 3 && current[0] === 0xef &&
    current[1] === 0xbb &&
    current[2] === 0xbf;
  if (!bom) {
    return body;
  }
  const withBom = new Uint8Array(body.length + 3);
  withBom.set([0xef, 0xbb, 0xbf]);
  withBom.set(body, 3);
  return withBom;
}
