#!/usr/bin/env bash
# add as dependency to your project
deno add jsr:@hugojosefson/markdown-server

# ...or...

# create and enter a directory for the script
mkdir -p "markdown-server"
cd       "markdown-server"

# download+extract the script, into current directory
curl -fsSL "https://github.com/hugojosefson/markdown-server/tarball/main" \
  | tar -xzv --strip-components=1
