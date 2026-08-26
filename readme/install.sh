#!/usr/bin/env bash
case "$(uname -s)" in
  Darwin) browser_opener=open ;;
  MINGW* | MSYS* | CYGWIN*) browser_opener=cmd ;;
  *) browser_opener=xdg-open ;;
esac
deno install --global --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED "--allow-run=${browser_opener},git" jsr:@hugojosefson/markdown-serve
