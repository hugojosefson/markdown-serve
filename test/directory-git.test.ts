import { assertMatch } from "@std/assert";
import { directoryIndex } from "../src/server/directory-index.ts";
import { parseGitStatus } from "../src/server/git/status.ts";

const entry = (name: string, directory = false) =>
  ({ name, directory, symlink: false, info: undefined }) as Parameters<
    typeof directoryIndex
  >[0][number];

Deno.test("directory Git column renders exact and aggregated status and sorts", () => {
  const status = parseGitStatus(
    "## main\0 M changed.md\0?? folder/new.md\0!! ignored.txt\0",
  );
  const html = directoryIndex(
    [entry("folder", true), entry("changed.md"), entry("ignored.txt")],
    new URL("http://x/?order=git"),
    "root",
    status,
  );
  assertMatch(html, /class="directory-git" scope="col" aria-sort="ascending"/);
  assertMatch(
    html,
    /data-git-kind="untracked" title="Untracked" aria-label="Untracked">\?\?<\/span>/,
  );
  assertMatch(
    html,
    /data-git-kind="modified" title="Modified" aria-label="Modified">M<\/span>/,
  );
  assertMatch(html, /data-git-kind="ignored"/);
  assertMatch(
    html,
    /data-kind="file" data-git-ignored="true"[^>]*>ignored\.txt/,
  );
});

Deno.test("directory Git column resolves nested paths", () => {
  const status = parseGitStatus(
    "## main\0 M docs/changed.md\0?? docs/folder/new.md\0",
  );
  const html = directoryIndex(
    [entry("folder", true), entry("changed.md")],
    new URL("http://x/docs/?order=git"),
    "root/docs/",
    status,
    "docs",
  );
  assertMatch(html, /data-git-kind="untracked"[^>]*>\?\?<\/span>/);
  assertMatch(html, /data-git-kind="modified"[^>]*>M<\/span>/);
});
