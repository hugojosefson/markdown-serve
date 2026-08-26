#!/usr/bin/env bash
case "$(uname -s)" in
  Darwin) browser_opener=open ;;
  MINGW* | MSYS* | CYGWIN*) browser_opener=cmd ;;
  *) browser_opener=xdg-open ;;
esac
deno install --global --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM "--allow-run=${browser_opener}" jsr:@hugojosefson/markdown-serve
