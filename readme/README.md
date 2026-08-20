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

## Usage

The command is `markdown-server [root] [options]`.

### Examples

```sh
"@@include(./example-usage)";
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

The [suggested installation](#installation) uses narrowly scoped runtime
permissions:

| Permission                               | Purpose                                                                          |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `--allow-read=.`                         | Read the current directory tree without granting access to the whole filesystem. |
| `--allow-net`                            | Serve HTTP and listen for browser connections.                                   |
| `--allow-env=CI,FORCE_COLOR,TERM`        | Read the listed terminal and CI settings.                                        |
| `--allow-run=xdg-open`, `open`, or `cmd` | Open the browser using the platform's standard command.                          |

Broader read grants can expose more files.

## URLs and pages

### Routing

| Request or case                      | Behavior                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `/guide` for `guide.md`              | Renders the Markdown file at its clean URL.                            |
| Direct `.md` URL such as `/guide.md` | Redirects to the clean URL, such as `/guide`.                          |
| `/docs/` with a Markdown index       | Renders `docs/README.md` or `docs/index.md`; `README.md` is preferred. |
| `/docs/?dir`                         | Lists directory entries, including dotfiles, with sortable metadata.   |
| Both `guide.md` and `guide/`         | `/guide` renders the file; `/guide/` opens the directory.              |
| Exact path to another file           | Serves the file as static content.                                     |
| Symlink                              | Follows its target within Deno's read-permission boundary.             |
| `/__markdown_server__/`              | Reserves this namespace for internal server endpoints.                 |

### Browser and redirects

| Setting          | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Browser opening  | Enabled by default. Failure produces a warning without stopping the server. |
| `--redirect=302` | Temporary canonical redirects; useful while testing.                        |
| `--redirect=301` | Permanent canonical redirects.                                              |

## Future features

- Add repository search opened with `/`, scoped to the viewed directory or the
  viewed file's directory. Use `rg` with a `search` query parameter, bounded and
  cancellable subprocesses, and UI controls or syntax for useful options such as
  fixed strings, smart case, globs, file types, hidden files, ignored files, and
  context lines.
- Add go-to-file navigation opened with `g`, scoped below the current directory.
  Prefer `fd` or `fdfind` when available, with catalog traversal as a portable
  fallback.
- Add editing only behind an explicit CLI option and exact write permission.
  Writes should be atomic. Explore cursor-preserving external updates,
  pause/focus-based autosave, and explicit conflict handling before attempting
  collaborative-style live updates.
- Use tree-sitter to offer predictable symbol anchors as an alternative to line
  anchors. Generate a symbol anchor only when its function, type, or other
  identifier is unique on the page.
- Use tree-sitter to link identifiers to definitions and references within the
  same file and across indexed files.

Revisit this list after the currently planned work and ask which idea, if any,
should be pursued next.
