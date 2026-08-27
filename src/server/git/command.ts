import { readCapped } from "../capped-stream.ts";

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
  const timeoutMs = options.timeoutMs ?? 2_000;
  const maxOutputBytes = options.maxOutputBytes ?? 1_000_000;
  let failure: Error | undefined;
  const stop = (error: Error): void => {
    if (failure) {
      return;
    }
    failure = error;
    try {
      child.kill("SIGTERM");
    } catch {
      // The child completed while the limit was being applied.
    }
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
      ),
      readCapped(
        child.stderr,
        maxOutputBytes,
        () => stop(new Error("git stderr exceeded output limit")),
      ),
      child.status,
    ]);
    if (failure) {
      throw failure;
    }
    return { success: status.success, stdout, stderr };
  } finally {
    clearTimeout(timer);
    if (failure) {
      await child.status.catch(() => {});
    }
  }
}
