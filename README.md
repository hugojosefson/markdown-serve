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
case "$(uname -s)" in
  Darwin) browser_opener=open ;;
  MINGW* | MSYS* | CYGWIN*) browser_opener=cmd ;;
  *) browser_opener=xdg-open ;;
esac
deno install --global --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM "--allow-run=${browser_opener}" jsr:@hugojosefson/markdown-server
```

## Usage

The command is `markdown-server [root] [options]`.

### Examples

```sh
# Serve the current directory, starting at http://localhost:8000.
markdown-server

# Choose a root, host, and port; do not open a browser.
markdown-server ./docs --host 127.0.0.1 --port 8080 --no-open

# Use temporary redirects while testing, or permanent redirects when desired.
markdown-server --redirect=302
markdown-server --redirect=301
```

### Options

| Argument or option         | Default     | Purpose                                |
| -------------------------- | ----------- | -------------------------------------- |
| `[root]`                   | `.`         | Directory to serve.                    |
| `--host <host>`            | `localhost` | Host to bind.                          |
| `--port <port>`            | `8000`      | Port to bind.                          |
| `--redirect=<301\|302>`    | `302`       | Status for canonical URL redirects.    |
| `--reload` / `--no-reload` | enabled     | Enable or disable browser live reload. |
| `--open` / `--no-open`     | enabled     | Enable or disable opening the browser. |
| `-h`, `--help`             | —           | Show command help.                     |
| `-V`, `--version`          | —           | Show the installed version.            |

### Port selection

When the default port is occupied, the server tries successive ports. An
occupied explicitly selected `--port` fails instead.

### Permissions

The installation uses narrowly scoped runtime permissions:

| Permission                               | Purpose                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `--allow-read=.`                         | Read the current directory tree without granting access to the whole filesystem. |
| `--allow-net`                            | Serve HTTP and listen for browser connections.                                   |
| `--allow-env=CI,FORCE_COLOR,TERM`        | Read the listed terminal and CI settings.                                        |
| `--allow-run=xdg-open`, `open`, or `cmd` | Open the browser using the platform's standard command.                          |

Broader read grants can expose more files.

## URLs and pages

### Routing

| Source                              | URL or behavior                                           |
| ----------------------------------- | --------------------------------------------------------- |
| `guide.md`                          | Clean URL `/guide`.                                       |
| `docs/README.md` or `docs/index.md` | Directory URL `/docs/`; `README.md` is preferred.         |
| Direct `.md` URL                    | Redirects to its clean URL.                               |
| Both `guide.md` and `guide/`        | `/guide` renders the file; `/guide/` opens the directory. |
| Other files                         | Served at their exact static path.                        |

### Generated-page features

| Feature             | Behavior                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Navigation          | Sticky, lazy desktop file tree and a mobile Browse link.                                         |
| Breadcrumbs         | Show the configured root and actual rendered source filename.                                    |
| Directory listings  | Sortable metadata columns, including permissions, binary size, user ID, modified time, and name. |
| Display controls    | Link-based light/auto/dark theme and narrow/wide layout choices.                                 |
| Source access       | Markdown and text pages include a Raw link.                                                      |
| Code blocks         | Show the detected language and a Copy button.                                                    |
| Live reload         | Included on generated pages when enabled; static assets do not include it.                       |
| Filesystem behavior | Dotfiles are listed and served; symlinks are followed within Deno's read-permission boundary.    |
| Internal routes     | `/__markdown_server__/` is reserved for server endpoints.                                        |

### Browser and redirects

| Setting          | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Browser opening  | Enabled by default. Failure produces a warning without stopping the server. |
| `--redirect=302` | Temporary canonical redirects; useful while testing.                        |
| `--redirect=301` | Permanent canonical redirects.                                              |
