import { readCapped } from "../capped-stream.ts";
import { childTerminator } from "../terminate-child.ts";

export type GitCommandResult = {
  success: boolean;
  stdout: string;
  stderr: string;
};
export type GitCommandOptions = { timeoutMs?: number; maxOutputBytes?: number };

export async function runGit(
  cwd: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<GitCommandResult> {
  const child = new Deno.Command("git", {
    args: ["--no-optional-locks", ...args],
    cwd,
    stdin: "null",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const terminator = childTerminator(child);
  const timeoutMs = options.timeoutMs ?? 2_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1_000_000;
  let failure: Error | undefined;
  const outputAbort = new AbortController();
  const stop = (error: Error): void => {
    if (failure) {
      return;
    }
    failure = error;
    outputAbort.abort();
    terminator.stop();
  };
  const timer = setTimeout(
    () => stop(new Error("git command timed out")),
    timeoutMs,
  );
  try {
    const [stdout, stderr, status] = await Promise.all([
      readCapped(
        child.stdout,
        maxOutputBytes,
        () => stop(new Error("git stdout exceeded output limit")),
        outputAbort.signal,
      ),
      readCapped(
        child.stderr,
        maxOutputBytes,
        () => stop(new Error("git stderr exceeded output limit")),
        outputAbort.signal,
      ),
      terminator.status,
    ]);
    if (failure) {
      throw failure;
    }
    return { success: status?.success ?? false, stdout, stderr };
  } catch (error) {
    if (failure) {
      throw failure;
    }
    const commandError = error instanceof Error
      ? error
      : new Error(String(error));
    stop(commandError);
    throw commandError;
  } finally {
    clearTimeout(timer);
  }
}
