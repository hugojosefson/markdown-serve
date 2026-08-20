import { assertEquals } from "@std/assert";
import {
  mergeDiffAnnotations,
  parseUnifiedDiff,
  untrackedAnnotations,
} from "../src/server/git/diff.ts";

Deno.test("zero-context diffs mark additions, deletions, replacements, and omitted counts", () => {
  assertEquals([...parseUnifiedDiff("@@ -1,0 +2 @@\n+x")], [[2, {}]]);
  assertEquals([...parseUnifiedDiff("@@ -2,2 +2,0 @@\n-a\n-b")], [[2, {
    deletions: 2,
  }]]);
  assertEquals([...parseUnifiedDiff("@@ -4,3 +4,1 @@\n-old\n+new")], [[4, {
    deletions: 3,
  }]]);
  assertEquals([...parseUnifiedDiff("@@ -7 +7 @@\n-old\n+new")], [[7, {
    deletions: 1,
  }]]);
});

Deno.test("deletions beyond current staged coordinates attach to the final line", () => {
  assertEquals([...parseUnifiedDiff("@@ -9,2 +9,0 @@", 3)], [[3, {
    deletions: 2,
  }]]);
});

Deno.test("zero-context diff parsing supports multiple hunks and ignores malformed input", () => {
  assertEquals([...parseUnifiedDiff("bad\n@@ -1,0 +1,2 @@\n@@ -8 +9 @@")], [
    [1, {}],
    [2, {}],
    [9, { deletions: 1 }],
  ]);
  assertEquals([...parseUnifiedDiff("@@ -x +1 @@\n@@ -1,wat +2 @@")], []);
});

Deno.test("diff annotations merge staged and unstaged overlays within displayed lines", () => {
  assertEquals(
    [...mergeDiffAnnotations("@@ -1,0 +2 @@", "@@ -1,0 +2 @@", 3)],
    [[2, { staged: true, unstaged: true }]],
  );
  assertEquals([...mergeDiffAnnotations("@@ -9 +9 @@", undefined, 3)], [[3, {
    staged: true,
    deletions: 1,
  }]]);
});

Deno.test("untracked annotations mark every displayed line", () => {
  assertEquals([...untrackedAnnotations(3)], [
    [1, { unstaged: true }],
    [2, { unstaged: true }],
    [3, { unstaged: true }],
  ]);
});
