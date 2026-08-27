#!/bin/sh
// 2>/dev/null;DENO_VERSION_RANGE="^2.9.5";case "$(uname -s)" in Darwin)browser_opener=open;;MINGW*|MSYS*|CYGWIN*)browser_opener=cmd;;*)browser_opener=xdg-open;;esac;DENO_RUN_ARGS="--watch --allow-read=. --allow-net --allow-run=${browser_opener},git,fd,fdfind --allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED";set -e;V="$DENO_VERSION_RANGE";A="$DENO_RUN_ARGS";h(){ [ -x "$(command -v "$1" 2>&1)" ];};n(){ [ "$(id -u)" != 0 ];};g(){ if n && ! h;then return;fi;u="$(n&&echo sudo||:)";if h brew;then echo "brew install $1";elif h apt;then echo "($u apt update && $u DEBIAN_FRONTEND=noninteractive apt install -y $1)";elif h yum;then echo "$u yum install -y $1";elif h pacman;then echo "$u pacman -yS --noconfirm $1";elif h opkg-install;then echo "$u opkg-install $1";fi;};p(){ q="$(g "$1")";if [ -z "$q" ];then echo "Please install '$1' manually, then try again.">&2;exit 1;fi;eval "o=\"\$(set +o)\";set -x;$q;set +x;eval \"\$o\"">&2;};f(){ h "$1"||p "$1";};w(){ [ -n "$1" ] && "$1" -V >/dev/null 2>&1;};U="$(l=$(printf "%s" "$V"|wc -c);for i in $(seq 1 $l);do c=$(printf "%s" "$V"|cut -c $i);printf '%%%02X' "'$c";done)";D="$(w "$(command -v deno||:)"||:)";t(){ i="$(if h findmnt;then findmnt -Ononoexec,noro -ttmpfs -nboAVAIL,TARGET|sort -rn|while IFS=$'\n\t ' read -r a m;do [ "$a" -ge 150000000 ]&&[ -d "$m" ]&&printf %s "$m"&&break||:;done;fi)";printf %s "${i:-"${TMPDIR:-/tmp}"}";};s(){ deno eval "import{satisfies as e}from'https://deno.land/x/semver@v1.4.1/mod.ts';Deno.exit(e(Deno.version.deno,'$V')?0:1);">/dev/null 2>&1;};e(){ R="$(t)/deno-range-$V/bin";mkdir -p "$R";export PATH="$R:$PATH";s&&return;f curl;v="$(curl -sSfL "https://semver.se.deno.net/api/github/denoland/deno/$U")";i="$(t)/deno-$v";ln -sf "$i/bin/deno" "$R/deno";s && return;f unzip;([ "${A#*-q}" != "$A" ]&&exec 2>/dev/null;curl -fsSL https://deno.land/install.sh|DENO_INSTALL="$i" sh -s $DENO_INSTALL_ARGS "$v"|grep -iv discord>&2);};e;exec deno run $A "$0" "$@"
import { openBrowser, usableUrl } from "./cli/browser.ts";
import {
  assertServePermissions,
  runtimeFeatureStatus,
} from "./cli/capabilities.ts";
import { parseCommand } from "./cli/parse-command.ts";
import { startServer } from "./cli/port.ts";
import { registerSignals } from "./cli/signals.ts";
import { usage } from "./cli/usage.ts";
import { version } from "./cli/version.ts";

export async function main(args: string[]): Promise<void> {
  try {
    const command = parseCommand(args);
    if (command.kind !== "serve") {
      console.log(
        command.kind === "help" ? usage + runtimeFeatureStatus() : version,
      );
      return;
    }
    const capabilities = assertServePermissions(
      command.options.root,
      command.options.host,
      command.options.port,
      command.options.open,
    );
    const abort = new AbortController();
    const unregister = registerSignals(() => abort.abort());
    try {
      const server = await startServer(
        command.options,
        abort.signal,
        capabilities.git,
        capabilities.finders,
      );
      const url = usableUrl(server.addr as Deno.NetAddr, command.options.host);
      console.log(`Serving ${await Deno.realPath(command.options.root)}`);
      console.log(url);
      if (
        capabilities.browser && command.options.open &&
        Deno.env.get("MARKDOWN_SERVE_BROWSER_OPENED") !== "true"
      ) {
        Deno.env.set("MARKDOWN_SERVE_BROWSER_OPENED", "true");
        openBrowser(url);
      }
      await server.finished;
    } finally {
      unregister();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    Deno.exitCode = 1;
  }
}

if (import.meta.main) {
  await main(Deno.args);
}
