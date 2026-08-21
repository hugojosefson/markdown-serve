import { assertEquals } from "@std/assert";
import { attachedCommentLine } from "../src/server/symbols/comment-attachment.ts";

Deno.test("language documentation comments attach to following declarations", () => {
  const fixtures = [
    ["javascript", "/** docs */\nfunction value() {}"],
    ["typescript", "/** docs */\nfunction value() {}"],
    ["java", "/** docs */\nclass Value {}"],
    ["csharp", "/// docs\nclass Value {}"],
    ["c", "/*! docs */\nint value(void) {}"],
    ["cpp", "//! docs\nint value() {}"],
    ["rust", "/// docs\nfn value() {}"],
  ] as const;
  for (const [language, source] of fixtures) {
    assertEquals(attachedCommentLine(source, language, 2), 1, language);
  }
});

Deno.test("ordinary block and contiguous line comments are fallbacks", () => {
  for (
    const language of [
      "c",
      "cpp",
      "csharp",
      "go",
      "java",
      "javascript",
      "jsx",
      "rust",
      "typescript",
      "tsx",
    ]
  ) {
    assertEquals(
      attachedCommentLine("/* ordinary */\ndeclaration", language, 2),
      1,
      language,
    );
  }
  for (const language of ["bash", "python"]) {
    assertEquals(
      attachedCommentLine("# first\n# second\ndeclaration", language, 3),
      1,
      language,
    );
  }
  assertEquals(
    attachedCommentLine(
      "// first\n// second\ndeclaration",
      "javascript",
      3,
    ),
    1,
  );
  assertEquals(
    attachedCommentLine(
      "/* block */\n// trailing line\ndeclaration",
      "javascript",
      3,
    ),
    1,
  );
});

Deno.test("comment attachment stops at blank lines and excludes shebangs", () => {
  assertEquals(
    attachedCommentLine("/** detached */\n\ndeclaration", "javascript", 3),
    undefined,
  );
  assertEquals(
    attachedCommentLine("// detached\n\ndeclaration", "javascript", 3),
    undefined,
  );
  assertEquals(
    attachedCommentLine("#!/usr/bin/env bash\ndeclaration", "bash", 2),
    undefined,
  );
});

Deno.test("a specific line-documentation block starts after ordinary comments", () => {
  assertEquals(
    attachedCommentLine(
      "// ordinary\n/// documentation\ndeclaration",
      "cpp",
      3,
    ),
    2,
  );
  assertEquals(
    attachedCommentLine(
      "/** documentation */\n// tooling directive\ndeclaration",
      "javascript",
      3,
    ),
    1,
  );
});
