import { escapeHtml } from "./html.ts";
import { metadataForFile } from "./file-metadata.ts";
import { htmlResponse } from "./html-response.ts";
import { page } from "./page.ts";
import { filePageActions } from "./page-action.ts";
import type { ServerConfig } from "./types.ts";

const sampleLength = 256;

export async function renderFile(
  config: ServerConfig,
  request: Request,
  url: URL,
  file: string,
  parts: string[],
): Promise<Response> {
  if (request.method === "HEAD") return htmlResponse(request, "");
  const info = await Deno.stat(file);
  const metadata = metadataForFile(file, info);
  return htmlResponse(
    request,
    await page(config, {
      title: url.pathname,
      parts,
      directory: false,
      url,
      metadata,
      fileActions: filePageActions(metadata.mime, metadata.mime),
      fileActionPlacement: "top",
      content: await fileContent(
        file,
        parts.at(-1) ?? "file",
        metadata.mime,
        info.size,
      ),
    }),
  );
}

async function fileContent(
  file: string,
  name: string,
  mime: string,
  size: number,
): Promise<string> {
  const raw = "?raw";
  const label = escapeHtml(name);
  if (mime.startsWith("image/")) {
    return `<img class="media-preview image" src="${raw}" alt="${label}">`;
  }
  if (mime === "application/pdf") {
    return `<embed class="media-preview pdf" src="${raw}" type="application/pdf" title="${label}">`;
  }
  if (mime.startsWith("audio/")) {
    return `<audio class="media-preview audio" controls src="${raw}" aria-label="${label}"></audio>`;
  }
  if (mime.startsWith("video/")) {
    return `<video class="media-preview video" controls src="${raw}" aria-label="${label}"></video>`;
  }
  return binarySample(await readSample(file), size);
}

async function readSample(path: string): Promise<Uint8Array> {
  const file = await Deno.open(path);
  try {
    const bytes = new Uint8Array(sampleLength);
    const read = await file.read(bytes);
    return bytes.subarray(0, read ?? 0);
  } finally {
    file.close();
  }
}

function binarySample(bytes: Uint8Array, size: number): string {
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const row = bytes.subarray(offset, offset + 16);
    const hex = Array.from(row, (byte) => byte.toString(16).padStart(2, "0"))
      .join(" ").padEnd(47, " ");
    const ascii = Array.from(
      row,
      (byte) => byte >= 32 && byte < 127 ? String.fromCharCode(byte) : ".",
    ).join("");
    rows.push(`${offset.toString(16).padStart(8, "0")}  ${hex}  |${ascii}|`);
  }
  const suffix = size > bytes.length
    ? `\n… truncated after ${bytes.length} bytes`
    : "";
  return `<div class="binary-sample"><pre>${
    escapeHtml(rows.join("\n") + suffix)
  }</pre></div>`;
}
