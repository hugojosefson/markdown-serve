#!/usr/bin/env bash
case "$(uname -s)" in
  Darwin) browser_opener=open ;;
  MINGW* | MSYS* | CYGWIN*) browser_opener=cmd ;;
  *) browser_opener=xdg-open ;;
esac
run_commands=()
for executable in "${browser_opener}" git fd fdfind rg; do
  if command -v "${executable}" >/dev/null 2>&1; then
    run_commands+=("${executable}")
  fi
done
run_args=()
if ((${#run_commands[@]})); then
  run_args+=("--allow-run=$(IFS=,; printf '%s' "${run_commands[*]}")")
fi
deno install --global --force --minimum-dependency-age=0 --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED "${run_args[@]}" jsr:@hugojosefson/markdown-serve
