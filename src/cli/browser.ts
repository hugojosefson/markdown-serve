import type { CommandRunner } from "./types.ts";

export type Warn = (message: string) => void;

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

export async function openBrowser(
  url: string,
  run: CommandRunner = async (command, args) =>
    await new Deno.Command(command, { args }).output(),
  warn: Warn = console.warn,
): Promise<void> {
  try {
    const [command, args] = openerCommand(url);
    if (!(await run(command, args)).success) {
      warn(`Could not open browser: ${command} failed`);
    }
  } catch (error) {
    warn(
      `Could not open browser: ${
        error instanceof Error ? error.message : error
      }`,
    );
  }
}
