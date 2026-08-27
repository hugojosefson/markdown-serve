const decoder = new TextDecoder();

export async function readCapped(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
  onLimit: () => void,
  signal?: AbortSignal,
): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const abort = () => reader.cancel().catch(() => {});
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return decoder.decode(join(chunks, length));
      if (length + value.length > maxBytes) {
        onLimit();
        await reader.cancel();
        return decoder.decode(join(chunks, length));
      }
      chunks.push(value);
      length += value.length;
    }
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}
function join(chunks: Uint8Array[], length: number): Uint8Array {
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
