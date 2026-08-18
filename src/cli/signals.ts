export function registerSignals(
  stop: () => void,
  os = Deno.build.os,
): () => void {
  const signals: Deno.Signal[] = os === "windows"
    ? ["SIGINT"]
    : ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    Deno.addSignalListener(signal, stop);
  }
  return () => {
    for (const signal of signals) {
      Deno.removeSignalListener(signal, stop);
    }
  };
}
