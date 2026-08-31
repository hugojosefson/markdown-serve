import { assertEquals, assertMatch } from "@std/assert";
import { draftDiff } from "../src/server/draft-diff.ts";

Deno.test("draft diffs expose bounded Git hunks and revert only in memory", () => {
  const head = "one\ntwo\nthree\nfour\n";
  const draft = "one\nchanged\nthree\nadded\nfour\n";
  const diff = draftDiff(head, draft)!;
  assertEquals(diff.limited, false);
  assertEquals(diff.hunks.length, 1);
  assertEquals(
    { start: diff.hunks[0].start, count: diff.hunks[0].count },
    { start: 2, count: 3 },
  );
  assertMatch(diff.hunks[0].text, /-two[\s\S]*\+changed/);
  assertEquals(draftDiff(head, draft, 0)?.draft, head);
  assertEquals(draftDiff(head, draft, 1), undefined);
});

Deno.test("draft diffs mark deletion-only hunks at an adjacent line", () => {
  const diff = draftDiff("one\ntwo\n", "two\n")!;
  assertEquals(diff.hunks.map(({ start, count }) => ({ start, count })), [
    { start: 1, count: 1 },
  ]);
});
