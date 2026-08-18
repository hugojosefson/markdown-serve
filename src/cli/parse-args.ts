import type { CliOptions } from "./types.ts";

const defaults: CliOptions = {
  root: ".",
  host: "localhost",
  port: 8000,
  explicitPort: false,
  redirectStatus: 302,
  reload: true,
  open: true,
};

export function parseArgs(args: string[]): CliOptions {
  return parseAt(args, 0, defaults, false);
}

function parseAt(
  args: string[],
  index: number,
  options: CliOptions,
  rootSeen: boolean,
): CliOptions {
  const arg = args[index];
  if (arg === undefined) {
    return options;
  }
  const [name, inline] = arg.split(/=(.*)/s, 2);
  if (["--host", "--port", "--redirect"].includes(name)) {
    const value = inline ?? args[index + 1];
    if (!value || value.startsWith("-")) {
      throw new Error(`${name} requires a value`);
    }
    return parseAt(
      args,
      index + (inline === undefined ? 2 : 1),
      withValue(options, name, value),
      rootSeen,
    );
  }
  if (arg === "--reload" || arg === "--no-reload") {
    return parseAt(
      args,
      index + 1,
      { ...options, reload: arg === "--reload" },
      rootSeen,
    );
  }
  if (arg === "--open" || arg === "--no-open") {
    return parseAt(
      args,
      index + 1,
      { ...options, open: arg === "--open" },
      rootSeen,
    );
  }
  if (arg.startsWith("-")) {
    throw new Error(`unknown option: ${arg}`);
  }
  if (rootSeen) {
    throw new Error("only one root path may be provided");
  }
  return parseAt(args, index + 1, { ...options, root: arg }, true);
}

function withValue(
  options: CliOptions,
  name: string,
  value: string,
): CliOptions {
  if (name === "--host") {
    return { ...options, host: value };
  }
  if (name === "--port") {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("--port must be an integer from 1 through 65535");
    }
    return { ...options, port, explicitPort: true };
  }
  const redirectStatus = Number(value);
  if (redirectStatus !== 301 && redirectStatus !== 302) {
    throw new Error("--redirect must be 301 or 302");
  }
  return { ...options, redirectStatus };
}
