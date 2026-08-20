import { assertEquals } from "@std/assert";
import {
  gitDirtyCount,
  gitDisplay,
  gitStatusAt,
  parseGitStatus,
} from "../src/server/git/status.ts";

Deno.test("parses branches, detached HEAD, and ahead/behind counts", () => {
  const branch = parseGitStatus("## main...origin/main [ahead 2, behind 3]\0");
  assertEquals([branch.branch, branch.detached, branch.ahead, branch.behind], [
    "main",
    false,
    2,
    3,
  ]);
  const detached = parseGitStatus("## HEAD (detached at 1234567)\0");
  assertEquals([detached.branch, detached.detached], [
    "HEAD (detached at 1234567)",
    true,
  ]);
});

Deno.test("looks up display status and excludes ignored files from dirty count", () => {
  const status = parseGitStatus(
    "## main\0 M docs/file.md\0?? docs/new.md\0!! cache/\0",
  );
  assertEquals(gitDisplay(gitStatusAt(status, "docs", true)), "M");
  assertEquals(gitDisplay(gitStatusAt(status, "docs/new.md")), "??");
  assertEquals(gitDirtyCount(status), 2);
});

Deno.test("looks up files collapsed under untracked and ignored directories", () => {
  const status = parseGitStatus("## main\0?? new/\0!! cache/\0");
  assertEquals(gitStatusAt(status, "new/nested/file.ts")?.kind, "untracked");
  assertEquals(gitStatusAt(status, "cache/data.bin")?.kind, "ignored");
  assertEquals(gitStatusAt(status, "other/file.ts"), undefined);
});

Deno.test("normalizes collapsed directories and chooses dominant status", () => {
  const status = parseGitStatus(
    "## main\0?? dir/new/\0 M dir/changed.md\0UU dir/conflict.md\0!! .cache/\0",
  );
  assertEquals(
    status.files.map((file) => [file.path, file.directory, file.kind]),
    [
      ["dir/new", true, "untracked"],
      ["dir/changed.md", false, "modified"],
      ["dir/conflict.md", false, "conflict"],
      [".cache", true, "ignored"],
    ],
  );
  assertEquals(status.directories.get("dir")?.kind, "conflict");
  assertEquals(status.directories.get("dir/new")?.kind, "untracked");
  assertEquals(status.byPath.get(".cache")?.kind, "ignored");
});

Deno.test("prefix strips rename paths before data and tooltips", () => {
  const status = parseGitStatus(
    "## main\0R  docs/new.md\0docs/old.md\0?? notes.md\0",
    "docs",
  );
  assertEquals(
    status.files.map((file) => [file.path, file.originalPath, file.tooltip]),
    [
      ["new.md", "old.md", "Renamed from old.md"],
    ],
  );
});
