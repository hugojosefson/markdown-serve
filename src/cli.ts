#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.9.5";DENO_RUN_ARGS="--allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};n(){ [ "$(id -u)" != 0 ];};g(){ if n && ! h;then return;fi;u="$(n&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver.se.deno.net/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;exec deno run $A "$0" "$@"
import { serve } from "./server.ts";
import { resolve } from "@std/path";

export interface CliOptions {
  root: string;
  host: string;
  port: number;
  explicitPort: boolean;
  redirectStatus: 301 | 302;
  reload: boolean;
  open: boolean;
}
export type Command = { kind: "help" | "version" } | {
  kind: "serve";
  options: CliOptions;
};
export const usage = `Usage: markdown-server [root] [options]

Options:
  --host <host>          Host to bind (default: localhost)
  --port <port>          Port to bind (default: 8000)
  --redirect=<301|302>   Canonical redirect status (default: 302)
  --[no-]reload          Store reload preference (default: enabled)
  --[no-]open            Store browser preference (default: enabled)
  -h, --help             Show this help
  -V, --version          Show version`;

export function parseCommand(args: string[]): Command {
  if (args.includes("-h") || args.includes("--help")) return { kind: "help" };
  if (args.includes("-V") || args.includes("--version")) {
    return { kind: "version" };
  }
  return { kind: "serve", options: parseArgs(args) };
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    root: ".",
    host: "localhost",
    port: 8000,
    explicitPort: false,
    redirectStatus: 302,
    reload: true,
    open: true,
  };
  const value = (name: string, index: number) => {
    const result = args[index + 1];
    if (!result || result.startsWith("-")) {
      throw new Error(`${name} requires a value`);
    }
    return result;
  };
  let rootSeen = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const [name, equalsValue] = arg.split(/=(.*)/s, 2);
    const optionValue = () => {
      const result = equalsValue ?? value(name, index++);
      if (!result) throw new Error(`${name} requires a value`);
      return result;
    };
    if (name === "--host") options.host = optionValue();
    else if (name === "--port") {
      const port = Number(optionValue());
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error("--port must be an integer from 1 through 65535");
      }
      options.port = port;
      options.explicitPort = true;
    } else if (name === "--redirect") {
      const status = Number(optionValue());
      if (status !== 301 && status !== 302) {
        throw new Error("--redirect must be 301 or 302");
      }
      options.redirectStatus = status;
    } else if (arg === "--reload") options.reload = true;
    else if (arg === "--no-reload") options.reload = false;
    else if (arg === "--open") options.open = true;
    else if (arg === "--no-open") options.open = false;
    else if (arg.startsWith("-")) throw new Error(`unknown option: ${arg}`);
    else if (rootSeen) throw new Error("only one root path may be provided");
    else {
      options.root = arg;
      rootSeen = true;
    }
  }
  return options;
}

/** Starts at the requested port, advancing only for the implicit default port. */
export async function startServer(
  options: CliOptions,
  signal?: AbortSignal,
): Promise<Deno.HttpServer> {
  for (let port = options.port; port <= 65535; port++) {
    try {
      return await serve({
        root: options.root,
        hostname: options.host,
        port,
        redirectStatus: options.redirectStatus,
        signal,
      });
    } catch (error) {
      if (options.explicitPort || !isAddressInUse(error) || port === 65535) {
        throw error;
      }
    }
  }
  throw new Error("no available port through 65535");
}
function isAddressInUse(error: unknown): boolean {
  return error instanceof Deno.errors.AddrInUse ||
    (error instanceof Error &&
      error.message.includes("Address already in use"));
}

export async function main(args: string[]): Promise<void> {
  try {
    const command = parseCommand(args);
    if (command.kind !== "serve") {
      console.log(command.kind === "help" ? usage : "0.0.0");
      return;
    }
    const abort = new AbortController();
    const stop = () => abort.abort();
    Deno.addSignalListener("SIGINT", stop);
    Deno.addSignalListener("SIGTERM", stop);
    try {
      const server = await startServer(command.options, abort.signal);
      const address = server.addr as Deno.NetAddr;
      console.log(
        `Serving ${await Deno.realPath(resolve(command.options.root))}`,
      );
      console.log(
        `http://${
          address.hostname.includes(":")
            ? `[${address.hostname}]`
            : address.hostname
        }:${address.port}/`,
      );
      await server.finished;
    } finally {
      Deno.removeSignalListener("SIGINT", stop);
      Deno.removeSignalListener("SIGTERM", stop);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    Deno.exitCode = 1;
  }
}

if (import.meta.main) await main(Deno.args);
