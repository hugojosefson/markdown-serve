export type Warn = (message: string) => void;

type BrowserProcess = {
  readonly status: Promise<{ success: boolean }>;
  unref(): void;
};

type CommandSpawner = (
  command: string,
  args: string[],
  options: Deno.CommandOptions,
) => BrowserProcess;

export const browserCommandOptions = {
  detached: true,
  stdin: "null",
  stdout: "null",
  stderr: "null",
} as const satisfies Deno.CommandOptions;

export function usableUrl(
  address: Deno.NetAddr,
  configuredHost?: string,
): string {
  const selectedHost = configuredHost ?? address.hostname;
  const host = selectedHost === "0.0.0.0" || selectedHost === "::"
    ? "localhost"
    : selectedHost;
  return `http://${host.includes(":") ? `[${host}]` : host}:${address.port}/`;
}

export function openerCommand(
  url: string,
  os = Deno.build.os,
): [string, string[]] {
  if (os === "windows") {
    return ["cmd", ["/c", "start", "", url]];
  }
  return [os === "darwin" ? "open" : "xdg-open", [url]];
}

export function openBrowser(
  url: string,
  spawn: CommandSpawner = (command, args, options) =>
    new Deno.Command(command, { ...options, args }).spawn(),
  warn: Warn = console.warn,
): void {
  try {
    const [command, args] = openerCommand(url);
    const child = spawn(command, args, browserCommandOptions);
    child.unref();
    void child.status.then(
      ({ success }) => {
        if (!success) {
          warn(`Could not open browser: ${command} failed`);
        }
      },
      (error) => warn(`Could not open browser: ${errorMessage(error)}`),
    );
  } catch (error) {
    warn(`Could not open browser: ${errorMessage(error)}`);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
