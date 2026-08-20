import { assertEquals } from "@std/assert";
import {
  codeLanguageForPath,
  codeLanguageForShebang,
} from "../src/server/code-language.ts";

Deno.test("unknown extensions use supported shebang interpreters", () => {
  assertEquals(
    codeLanguageForPath("hook.sample", "#!/bin/sh\necho ok\n"),
    "bash",
  );
  assertEquals(
    codeLanguageForPath("tool", "#!/usr/bin/env python3 -u\nprint('ok')\n"),
    "python",
  );
  assertEquals(
    codeLanguageForPath("tool", "#!/usr/bin/env -S deno run --allow-read\n"),
    "typescript",
  );
  assertEquals(
    codeLanguageForPath("tool", "#!/usr/bin/env -S deno run --ext=js\n"),
    "javascript",
  );
  assertEquals(
    codeLanguageForPath("tool", "#!/usr/bin/env -S 'python3' -u\n"),
    "python",
  );
  assertEquals(
    codeLanguageForPath("tool", "#!/usr/bin/env MODE=test node\n"),
    "javascript",
  );
});

Deno.test("known extensions take precedence and unsupported interpreters stay text", () => {
  assertEquals(
    codeLanguageForPath("tool.ts", "#!/usr/bin/env node\n"),
    "typescript",
  );
  assertEquals(codeLanguageForPath("tool.sample", "#!/usr/bin/ruby\n"), "text");
  assertEquals(codeLanguageForShebang("ordinary text"), undefined);
});

Deno.test("known filenames and contextual paths use supported Prism languages", () => {
  assertEquals(codeLanguageForPath(".git/config"), "ini");
  assertEquals(codeLanguageForPath("C:\\repo\\.git\\config"), "ini");
  assertEquals(codeLanguageForPath(".gitconfig"), "ini");
  assertEquals(codeLanguageForPath(".editorconfig"), "ini");
  assertEquals(codeLanguageForPath("Dockerfile"), "text");
});

Deno.test("known paths take precedence over shebangs after extensions", () => {
  assertEquals(
    codeLanguageForPath(".git/hooks/applypatch-msg.sample", "#!/bin/sh\n"),
    "bash",
  );
  assertEquals(
    codeLanguageForPath(".editorconfig", "#!/bin/sh\nroot = true\n"),
    "ini",
  );
});
