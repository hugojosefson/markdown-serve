/** Editor-private history state. Inline state uses a gzip base64url payload. */
export const editorUrlInlineLimit = 24_000;
// Two 1 MiB documents can expand sixfold when JSON escapes control bytes.
const editorUrlDecodedLimit = 2 * 1024 * 1024 * 6 + 1024;

export type EditorDocumentState = {
  v: 1;
  base: string;
  draft: string;
  tag: string;
};

const bytes = (value: string) => new TextEncoder().encode(value);
const text = (value: Uint8Array) => new TextDecoder().decode(value);
const base64url = (value: Uint8Array) =>
  btoa(
    Array.from({ length: Math.ceil(value.length / 0x8000) }, (_, index) =>
      String.fromCharCode(
        ...value.subarray(index * 0x8000, (index + 1) * 0x8000),
      )).join(""),
  )
    .replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const unbase64url = (value: string): Uint8Array | undefined => {
  try {
    const decoded = atob(value.replaceAll("-", "+").replaceAll("_", "/"));
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
};
const readBounded = async (
  stream: ReadableStream<Uint8Array>,
  limit: number,
): Promise<Uint8Array | undefined> => {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(value);
    }
  } catch {
    return undefined;
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

export async function encodeEditorDocument(
  state: EditorDocumentState,
): Promise<string | undefined> {
  if (typeof CompressionStream === "undefined") return undefined;
  const stream = new Blob([JSON.stringify(state)]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  const encoded = await readBounded(stream, editorUrlInlineLimit + 1);
  return encoded ? base64url(encoded) : undefined;
}

export async function decodeEditorDocument(
  value: string,
): Promise<EditorDocumentState | undefined> {
  if (value.length > editorUrlInlineLimit) return undefined;
  const encoded = unbase64url(value);
  if (!encoded || typeof DecompressionStream === "undefined") return undefined;
  try {
    const stream = new Blob([encoded.slice().buffer]).stream().pipeThrough(
      new DecompressionStream("gzip"),
    );
    const decoded = await readBounded(stream, editorUrlDecodedLimit);
    if (!decoded) return undefined;
    const result: unknown = JSON.parse(text(decoded));
    if (!result || typeof result !== "object") return undefined;
    const state = result as Partial<EditorDocumentState>;
    return state.v === 1 && typeof state.base === "string" &&
        typeof state.draft === "string" && typeof state.tag === "string"
      ? state as EditorDocumentState
      : undefined;
  } catch {
    return undefined;
  }
}

export const editorUrlStateClient =
  `const bytes=${bytes.toString()};const text=${text.toString()};const base64url=${base64url.toString()};const unbase64url=${unbase64url.toString()};const readBounded=${readBounded.toString()};const editorUrlInlineLimit=${editorUrlInlineLimit};const editorUrlDecodedLimit=${editorUrlDecodedLimit};${encodeEditorDocument.toString()}${decodeEditorDocument.toString()}`;
