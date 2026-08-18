# markdown-server

[![JSR Version](https://jsr.io/badges/@hugojosefson/markdown-server)](https://jsr.io/@hugojosefson/markdown-server)
[![JSR Score](https://jsr.io/badges/@hugojosefson/markdown-server/score)](https://jsr.io/@hugojosefson/markdown-server)
[![CI](https://github.com/hugojosefson/markdown-server/actions/workflows/release.yaml/badge.svg)](https://github.com/hugojosefson/markdown-server/actions/workflows/release.yaml)

Local web server that automatically renders markdown using
https://jsr.io/@deno/gfm

## Requirements

Requires [Deno](https://deno.com/) v2.9.5 or later.

## API

Please see docs on
[jsr.io/@hugojosefson/markdown-server](https://jsr.io/@hugojosefson/markdown-server).

## Installation

```sh
deno install --global --allow-read --allow-net --allow-env jsr:@hugojosefson/markdown-server
```

## Example usage

```typescript
# share current dir
deno run --allow-read=. --allow-net --allow-env jsr:@hugojosefson/markdown-server
```
