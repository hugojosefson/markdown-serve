import { parseArgs } from "./parse-args.ts";
import type { Command } from "./types.ts";

export function parseCommand(args: string[]): Command {
  if (args.includes("-h") || args.includes("--help")) {
    return { kind: "help" };
  }
  if (args.includes("-V") || args.includes("--version")) {
    return { kind: "version" };
  }
  return { kind: "serve", options: parseArgs(args) };
}
