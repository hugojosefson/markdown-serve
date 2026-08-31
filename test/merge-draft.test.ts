import { assertEquals, assertMatch } from "@std/assert";
import { mergeDraft } from "../src/server/merge-draft.ts";

Deno.test("draft merge loads disk changes when the editor is clean", () => {
  assertEquals(mergeDraft("one\n", "one\n", "two\n"), {
    draft: "two\n",
    conflicted: false,
    limited: false,
  });
});

Deno.test("draft merge combines independent local and disk changes", () => {
  assertEquals(
    mergeDraft("one\ntwo\nthree\n", "ONE\ntwo\nthree\n", "one\ntwo\nTHREE\n"),
    {
      draft: "ONE\ntwo\nTHREE\n",
      conflicted: false,
      limited: false,
    },
  );
});

Deno.test("draft merge accepts matching edits and preserves final newlines", () => {
  assertEquals(mergeDraft("one\n", "same\n", "same\n"), {
    draft: "same\n",
    conflicted: false,
    limited: false,
  });
});

Deno.test("draft merge exposes overlapping edits for manual resolution", () => {
  const merged = mergeDraft("one\n", "mine\n", "theirs\n");
  assertEquals([merged.conflicted, merged.limited], [true, false]);
  assertMatch(
    merged.draft,
    /<<<<<<< draft\nmine\n\|\|\|\|\|\|\| previous disk version\none\n=======\ntheirs\n>>>>>>> current disk version/,
  );
});

Deno.test("draft merge normalizes browser line endings", () => {
  assertEquals(mergeDraft("one\r\n", "one\n", "two\r\n").draft, "two\n");
});

Deno.test("draft merge bounds pathological line counts", () => {
  const base = `${
    Array.from({ length: 2_001 }, (_, index) => index).join("\n")
  }\n`;
  const merged = mergeDraft(base, `local\n${base}`, `${base}disk\n`);
  assertEquals([merged.draft, merged.conflicted, merged.limited], [
    `local\n${base}`,
    false,
    true,
  ]);
});
