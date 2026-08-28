import {
  boundedBody,
  editableFile,
  editablePath,
  editLimit,
  editTag,
  sameOrigin,
  validText,
} from "./edit-response.ts";
import { mergeDraft, normalizeEditorText } from "./merge-draft.ts";
import type { ServerConfig } from "./types.ts";

type MergeRequest = { base: string; draft: string; tag: string };

/** Reads and three-way merges a newer disk version; it never writes. */
export async function editMergeResponse(
  config: ServerConfig,
  request: Request,
  url: URL,
): Promise<Response> {
  if (!config.edit) {
    return new Response("Not Found", { status: 404 });
  }
  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
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
    !/^application\/json\s*;\s*charset=utf-8\s*$/i.test(
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
  const body = await boundedBody(request, editLimit * 4 + 2048);
  if (!body) {
    return new Response("Payload Too Large", { status: 413 });
  }
  const input = parseMergeRequest(body);
  if (!input) {
    return new Response("Bad Request", { status: 400 });
  }
  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }
  if (!await editableFile(config.rootPath, path, config.access)) {
    if (config.access?.isDenied(path)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Not Found", { status: 404 });
  }
  let current: Uint8Array;
  try {
    current = await Deno.readFile(path);
  } catch (error) {
    if (config.access?.handlePermissionDenied(path, error)) {
      return new Response("Forbidden", { status: 403 });
    }
    return new Response("Not Found", { status: 404 });
  }
  if (
    request.signal.aborted ||
    !await editableFile(config.rootPath, path, config.access)
  ) {
    return request.signal.aborted
      ? new Response(null, { status: 499 })
      : config.access?.isDenied(path)
      ? new Response("Forbidden", { status: 403 })
      : new Response("Not Found", { status: 404 });
  }
  if (!validText(current)) {
    return new Response("Not Found", { status: 404 });
  }
  const tag = editTag(current);
  if (input.tag === tag) {
    return mergeJson({ changed: false });
  }
  const disk = normalizeEditorText(new TextDecoder().decode(current));
  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }
  const merged = mergeDraft(input.base, input.draft, disk);
  if (request.signal.aborted) {
    return new Response(null, { status: 499 });
  }
  if (merged.limited) {
    return mergeJson({ changed: true, limited: true });
  }
  return mergeJson({
    changed: true,
    limited: false,
    base: disk,
    draft: merged.draft,
    tag,
    conflicted: merged.conflicted,
  });
}

function parseMergeRequest(bytes: Uint8Array): MergeRequest | undefined {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const input = value as Record<string, unknown>;
  if (
    Object.keys(input).length !== 3 || typeof input.base !== "string" ||
    typeof input.draft !== "string" || typeof input.tag !== "string" ||
    !/^"[0-9a-f]{64}"$/.test(input.tag)
  ) {
    return undefined;
  }
  const base = new TextEncoder().encode(input.base);
  const draft = new TextEncoder().encode(input.draft);
  return validText(base) && validText(draft)
    ? { base: input.base, draft: input.draft, tag: input.tag }
    : undefined;
}

function mergeJson(value: object): Response {
  return Response.json(value, {
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
