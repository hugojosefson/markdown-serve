import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { SymbolCatalog } from "../src/server/symbols/catalog.ts";
import { fixture } from "./fixture.ts";

Deno.test("symbol catalog excludes duplicates and drops stale targets after invalidation", async () => {
  const f = await fixture({ "one.ts": "export function unique() {}\n" });
  try {
    const catalog = new SymbolCatalog(f.root);
    assertEquals(
      await catalog.targets(),
      new Map([["unique", "/one.ts#symbol-unique"]]),
    );
    await Deno.writeTextFile(join(f.root, "two.ts"), "function unique() {}\n");
    assertEquals(
      await catalog.targets(),
      new Map([["unique", "/one.ts#symbol-unique"]]),
    );
    catalog.clear();
    assertEquals(await catalog.targets(), new Map());
  } finally {
    await f.cleanup();
  }
});

Deno.test("symbol catalog skips unsupported text and Markdown headings", async () => {
  const f = await fixture({
    "guide.md": "# documented\n",
    "notes.txt": "function documented() {}\n",
  });
  try {
    assertEquals(await new SymbolCatalog(f.root).targets(), new Map());
  } finally {
    await f.cleanup();
  }
});

Deno.test("symbol catalog recognizes extensionless shebang sources", async () => {
  const f = await fixture({
    "tool": "#!/usr/bin/env deno\nexport function run() {}\n",
  });
  try {
    assertEquals(
      await new SymbolCatalog(f.root).targets(),
      new Map([["run", "/tool#symbol-run"]]),
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("symbol catalog excludes VCS metadata directories", async () => {
  const f = await fixture({
    "one.ts": "export function visible() {}\n",
    ".git/hidden.ts": "export function hidden() {}\n",
    ".hg/hidden.ts": "export function hgHidden() {}\n",
    ".svn/hidden.ts": "export function svnHidden() {}\n",
  });
  try {
    assertEquals(
      await new SymbolCatalog(f.root).targets(),
      new Map([["visible", "/one.ts#symbol-visible"]]),
    );
  } finally {
    await f.cleanup();
  }
});

for (
  const [name, limits] of [
    ["traversal entries", { maxTraversalEntries: 0 }],
    ["supported files", { maxSupportedFiles: 0 }],
    ["total bytes", { maxTotalBytes: 0 }],
  ] as const
) {
  Deno.test(`symbol catalog fails closed at ${name} budget`, async () => {
    const f = await fixture({ "one.ts": "export function unique() {}\n" });
    try {
      assertEquals(
        await new SymbolCatalog(f.root, limits).targets(),
        new Map(),
      );
    } finally {
      await f.cleanup();
    }
  });
}
