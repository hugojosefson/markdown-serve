# markdown-server

[![JSR Version](https://jsr.io/badges/@hugojosefson/markdown-server)](https://jsr.io/@hugojosefson/markdown-server)
[![JSR Score](https://jsr.io/badges/@hugojosefson/markdown-server/score)](https://jsr.io/@hugojosefson/markdown-server)
[![CI](https://github.com/hugojosefson/markdown-server/actions/workflows/release.yaml/badge.svg)](https://github.com/hugojosefson/markdown-server/actions/workflows/release.yaml)

Local Deno 2 web server that renders Markdown using https://jsr.io/@deno/gfm,
with GitHub-like GFM output.

## Requirements

Requires [Deno](https://deno.com/) v2.9.5 or later.

This is currently a CLI-first package; it does not promise a public library API.

## Installation

```sh
"@@include(./install.sh)";
```

## Example usage

```sh
"@@include(./example-usage)";
```

The command is `markdown-server [root]`. The root defaults to `.`, the host to
`localhost`, and the port to `8000`. If the default port was omitted and is
occupied, the server tries successive ports; an occupied explicit `--port`
fails. Options are `--host`, `--port`, `--redirect=301|302` (default `302`),
`--reload`/`--no-reload` (default reload), `--open`/`--no-open` (default open),
`--help`, and `--version`.

Installation grants `--allow-read=.` so the server can read the current
directory tree without granting read access everywhere. It also needs
`--allow-net`, `--allow-env=CI,FORCE_COLOR,TERM`, and one platform-specific
browser opener (`xdg-open`, `open`, or `cmd`). Broader read grants can expose
more files.

## URLs and pages

Markdown files have clean URLs: `guide.md` is `/guide`, while a directory's
`README.md` or `index.md` is `/docs/`; `README.md` is preferred. Direct `.md`
URLs redirect to their clean URL. An ordinary Markdown file wins a conflict at
`/guide`; `/guide/` accesses the directory. Other static files are served.

Generated Markdown pages, directory-index pages, and no-index listings include a
desktop sticky lazy navigation tree, a mobile Browse control, and breadcrumbs.
Live reload is included on generated pages when enabled, not on static assets.
Dotfiles are listed and served, and symlinks are followed; Deno's read
permissions remain the boundary, including for symlink targets. The reserved
`/__markdown_server__/` namespace is used internally.

The browser opens by default. If opening it fails, the server warns and keeps
running. Use `--redirect=302` for temporary redirects while testing and
`--redirect=301` when permanent redirects are desired.
