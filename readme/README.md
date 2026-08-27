# markdown-serve

[![JSR Version](https://jsr.io/badges/@hugojosefson/markdown-serve)](https://jsr.io/@hugojosefson/markdown-serve)
[![JSR Score](https://jsr.io/badges/@hugojosefson/markdown-serve/score)](https://jsr.io/@hugojosefson/markdown-serve)
[![CI](https://github.com/hugojosefson/markdown-serve/actions/workflows/release.yaml/badge.svg)](https://github.com/hugojosefson/markdown-serve/actions/workflows/release.yaml)

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

The command is `markdown-serve [root] [options]`.

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

| Permission                                                      | Purpose                                                                          |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--allow-read=.`                                                | Read the current directory tree without granting access to the whole filesystem. |
| `--allow-net`                                                   | Serve HTTP and listen for browser connections.                                   |
| `--allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED` | Read terminal and CI settings and retain browser state across watched restarts.  |
| `--allow-run=xdg-open,git`, `open,git`, or `cmd,git`            | Open the browser and read Git status using only the required commands.           |

Broader read grants can expose more files.

## URLs and pages

### Source symbols

Source views recognize declarations and link matching identifiers in Bash, C,
C++, C#, Go, Java, JavaScript/JSX, Python, Rust, and TypeScript/TSX. A unique
page-local declaration takes precedence; otherwise a declaration unique in the
served tree is linked to its source page. Ambiguous names stay unlinked.
Declaration names link to a unique `#symbol-name` anchor when possible; all
source lines retain their `#L` anchors. Markdown source headings use the same
fragments as rendered headings. Links scroll to an attached documentation,
block, or contiguous line comment while highlighting the declaration line.
Parsing is skipped above 1 MiB or when a grammar fails, without affecting source
rendering.

### Routing

| Request or case                      | Behavior                                                               |
| ------------------------------------ | ---------------------------------------------------------------------- |
| `/guide` for `guide.md`              | Renders the Markdown file at its clean URL.                            |
| Direct `.md` URL such as `/guide.md` | Redirects to the clean URL, such as `/guide`.                          |
| `/docs/` with a Markdown index       | Renders `docs/README.md` or `docs/index.md`; `README.md` is preferred. |
| `/docs/?dir`                         | Lists directory entries, including dotfiles, with sortable metadata.   |
| Both `guide.md` and `guide/`         | `/guide` renders the file; `/guide/` opens the directory.              |
| Exact path to another text file      | Shows highlighted source with file actions.                            |
| `View page` on an HTML source page   | Opens a sandboxed website preview in a new tab.                        |
| `/__markdown_serve__/site/...`       | Serves preview files and relative assets with their normal MIME types. |
| Symlink                              | Follows its target within Deno's read-permission boundary.             |
| `/__markdown_serve__/`               | Reserves this namespace for internal server endpoints.                 |

Directory listings and navigation trees group directories before files. Selected
table ordering applies within each group.

### Browser and redirects

Humanized timestamps update in the browser when their displayed value changes,
with progressively longer delays for older timestamps.

| Setting          | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Browser opening  | Enabled by default. Failure produces a warning without stopping the server. |
| `--redirect=302` | Temporary canonical redirects; useful while testing.                        |
| `--redirect=301` | Permanent canonical redirects.                                              |
