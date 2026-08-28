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
case "$(uname -s)" in
  Darwin) browser_opener=open ;;
  MINGW* | MSYS* | CYGWIN*) browser_opener=cmd ;;
  *) browser_opener=xdg-open ;;
esac
deno install --global --force --minimum-dependency-age=0 --allow-read=. --allow-net --allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED "--allow-run=${browser_opener},git,fd,fdfind,rg" jsr:@hugojosefson/markdown-serve
```

## Usage

The command is `markdown-serve [root] [options]`.

### Examples

```sh
# Serve the current directory, starting at http://localhost:8000.
markdown-serve

# Choose a root, host, and port; do not open a browser.
markdown-serve ./docs --host 127.0.0.1 --port 8080 --no-open

# Use temporary redirects while testing, or permanent redirects when desired.
markdown-serve --redirect=302
markdown-serve --redirect=301
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
| `--edit` / `--no-edit`     | disabled    | Enable editing eligible text files.    |
| `-h`, `--help`             | —           | Show command help.                     |
| `-V`, `--version`          | —           | Show the installed version.            |

### Port selection

When the default port is occupied, the server tries successive ports. An
occupied explicitly selected `--port` fails instead.

### Permissions

The [suggested installation](#installation) uses narrowly scoped runtime
permissions:

| Permission                                                                                  | Purpose                                                                          |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `--allow-read=.`                                                                            | Read the current directory tree without granting access to the whole filesystem. |
| `--allow-net`                                                                               | Serve HTTP and listen for browser connections.                                   |
| `--allow-env=CI,FORCE_COLOR,TERM,MARKDOWN_SERVE_BROWSER_OPENED`                             | Read terminal and CI settings and retain browser state across watched restarts.  |
| `--allow-run=xdg-open,git,fd,fdfind,rg`, `open,git,fd,fdfind,rg`, or `cmd,git,fd,fdfind,rg` | Open the browser, read Git status, and use optional searches.                    |

Broader read grants can expose more files.

### Editing

Editing is disabled by default. Install or run an explicit opt-in command with a
write permission scoped to the served root, for example:

```sh
deno run --allow-read=. --allow-write=. --allow-net jsr:@hugojosefson/markdown-serve --edit .
```

The editor only changes existing regular UTF-8 text files below that root. It
uses version checks and atomic replacement; it cannot create files or follow
symlinks. Dedicated edit pages and their Save forms work without JavaScript.
When JavaScript and Git are available, the editor adds live highlighting and Git
`HEAD` change markers. Reverting a marker only updates the draft; only Save
writes to disk. Markdown editors default to a full-width editor and link to
stacked, side-by-side, or preview-only layouts. Split layouts synchronize
scrolling and mark the editor caret or selection in the rendered preview.
Enhanced pages keep the draft, file version, selection, and scroll positions in
the URL across layout changes, reloads, and browser history. Browser-session
storage safeguards new input while URL compression is pending and holds drafts
too large for a practical URL. Other source formats use their syntax
highlighting. The browser warns before leaving a changed draft. Live-reload
events automatically load and three-way merge external filesystem changes;
overlapping edits remain marked for manual resolution.

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
rendering. The cross-file symbol index is bounded and fails closed when
traversal or indexing is truncated.

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

### Go to file

Press `g` to search files and directories from the content root. The picker
starts with the viewed directory in its input; replace that prefix to search
elsewhere. Typed characters match in order against each full relative path.
Results include dotfiles and use canonical routes, including clean Markdown
URLs. Use up/down and Enter to open a match. Escape or a backdrop click closes
the picker. `fd` or `fdfind` is used when permitted and available; otherwise the
server uses a bounded filesystem scan.

### Repository search

Press `/` to search below the viewed directory (or the viewed file's directory).
It uses `rg` when `--allow-run=rg` is granted. The `search` endpoint accepts
`fixed=1`, `smartCase=1`, `glob`, `type`, `hidden=1`, `ignored=1`, and
`context=0` through `8`; the dialog exposes these options. Results are capped at
100 matches (context lines do not count), include requested context, and link to
source lines. Search runtime and each output stream are bounded.

### Browser and redirects

Humanized timestamps update in the browser when their displayed value changes,
with progressively longer delays for older timestamps.

| Setting          | Behavior                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Browser opening  | Enabled by default. Failure produces a warning without stopping the server. |
| `--redirect=302` | Temporary canonical redirects; useful while testing.                        |
| `--redirect=301` | Permanent canonical redirects.                                              |
