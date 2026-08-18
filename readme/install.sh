#!/usr/bin/env bash
deno install --global --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM --allow-run=xdg-open,open,cmd jsr:@hugojosefson/markdown-server
