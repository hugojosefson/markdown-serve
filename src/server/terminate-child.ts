export type TerminableChild = {
  status: Promise<Deno.CommandStatus>;
  kill(signal?: Deno.Signal): void;
};

const defaultGraceMilliseconds = 50;

export async function terminateChild(
  child: TerminableChild,
  graceMilliseconds = defaultGraceMilliseconds,
): Promise<void> {
  let settled = false;
  const status = child.status.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  try {
    child.kill("SIGTERM");
  } catch { /* already exited */ }
  await Promise.race([status, delay(graceMilliseconds)]);
  if (!settled) {
    try {
      child.kill("SIGKILL");
    } catch { /* exited while escalating */ }
    await Promise.race([status, delay(graceMilliseconds)]);
  }
}

export function childTerminator(
  child: TerminableChild,
  graceMilliseconds = defaultGraceMilliseconds,
): {
  status: Promise<Deno.CommandStatus | undefined>;
  stop(): void;
} {
  let trigger!: () => void;
  let stopping: Promise<void> | undefined;
  const requested = new Promise<void>((resolve) => trigger = resolve);
  return {
    status: Promise.race([
      child.status.catch(() => undefined),
      requested.then(async () => {
        await stopping;
        return undefined;
      }),
    ]),
    stop() {
      if (stopping) return;
      stopping = terminateChild(child, graceMilliseconds);
      trigger();
    },
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
