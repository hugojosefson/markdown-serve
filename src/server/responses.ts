import { basename } from "@std/path";
import { canonicalQuery } from "./query.ts";
import { fileMime } from "./file-metadata.ts";

export function plain(text: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : text, { status });
}

export function redirect(
  url: URL,
  pathname: string,
  status: 301 | 302,
  method: string,
): Response {
  url.pathname = pathname;
  const query = canonicalQuery(url.search);
  return new Response(method === "HEAD" ? null : "Redirecting", {
    status,
    headers: { Location: `${url.pathname}${query ? `?${query}` : ""}` },
  });
}

export async function rawFile(
  request: Request,
  path: string,
  text = false,
): Promise<Response> {
  const file = await Deno.open(path);
  let info: Deno.FileInfo;
  try {
    info = await file.stat();
  } catch (error) {
    file.close();
    throw error;
  }
  const mime = text ? "text/plain; charset=UTF-8" : fileMime(path);
  const range = request.headers.get("range");
  const parsed = range ? byteRange(range, info.size) : undefined;
  if (range && !parsed) {
    file.close();
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${info.size}`,
        "Accept-Ranges": "bytes",
      },
    });
  }
  const start = parsed?.start ?? 0;
  const end = parsed?.end ?? info.size - 1;
  const length = Math.max(0, end - start + 1);
  const headers = new Headers({
    "Content-Type": mime,
    "Content-Length": String(length),
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
  });
  if (mime === "image/svg+xml") {
    headers.set(
      "Content-Security-Policy",
      "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'",
    );
  }
  if (parsed) {
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
  }
  const body = await fileBody(request, file, start, length);
  return new Response(
    body,
    { status: parsed ? 206 : 200, headers },
  );
}

export async function downloadFile(
  request: Request,
  path: string,
): Promise<Response> {
  const file = await Deno.open(path);
  let info: Deno.FileInfo;
  try {
    info = await file.stat();
  } catch (error) {
    file.close();
    throw error;
  }
  const headers = new Headers({
    "Content-Type": fileMime(path),
    "Content-Length": String(info.size),
    "Content-Disposition": contentDisposition(basename(path)),
    "X-Content-Type-Options": "nosniff",
  });
  const body = await fileBody(request, file, 0, info.size);
  return new Response(
    body,
    { headers },
  );
}

function byteRange(
  value: string,
  size: number,
): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]) || size === 0) {
    return undefined;
  }
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    return Number.isSafeInteger(suffixLength) && suffixLength > 0
      ? { start: Math.max(0, size - suffixLength), end: size - 1 }
      : undefined;
  }
  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(requestedEnd) &&
      start <= requestedEnd && start < size
    ? { start, end: Math.min(requestedEnd, size - 1) }
    : undefined;
}

async function fileBody(
  request: Request,
  file: Deno.FsFile,
  start: number,
  length: number,
): Promise<ReadableStream<Uint8Array> | ArrayBuffer | null> {
  if (request.method === "HEAD") {
    file.close();
    return null;
  }
  if (!length) {
    file.close();
    return new ArrayBuffer(0);
  }
  return await fileStream(file, start, length);
}

async function fileStream(
  file: Deno.FsFile,
  start: number,
  length: number,
): Promise<ReadableStream<Uint8Array>> {
  let closed = false;
  const close = () => {
    if (!closed) {
      closed = true;
      file.close();
    }
  };
  try {
    await file.seek(start, Deno.SeekMode.Start);
  } catch (error) {
    close();
    throw error;
  }
  let remaining = length;
  return new ReadableStream({
    async pull(controller) {
      try {
        const chunk = new Uint8Array(Math.min(64 * 1024, remaining));
        const read = await file.read(chunk);
        if (read === null || read === 0) {
          close();
          controller.close();
          return;
        }
        remaining -= read;
        controller.enqueue(chunk.subarray(0, read));
        if (!remaining) {
          close();
          controller.close();
        }
      } catch (error) {
        close();
        controller.error(error);
      }
    },
    cancel() {
      close();
    },
  });
}

function contentDisposition(name: string): string {
  const safe = name.replace(/[\r\n]/g, "_");
  const fallback = safe.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(safe).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
