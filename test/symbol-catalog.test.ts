import { assertEquals } from "@std/assert";
import { join } from "@std/path";
import { SymbolCatalog } from "../src/server/symbols/catalog.ts";
import { FileAccess } from "../src/server/file-access.ts";
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

Deno.test("symbol catalog skips filesystem-specific read failures", async () => {
  const f = await fixture({
    "visible.ts": "export function visible() {}\n",
    "broken.ts": "export function broken() {}\n",
    "unreadable.ts": "export function unreadable() {}\n",
    "blocked/hidden.ts": "export function hidden() {}\n",
  });
  const access = new FileAccess(f.root, () => {}, {
    stat: (path) =>
      path === join(f.root, "broken.ts")
        ? Promise.reject(new TypeError("Invalid argument (os error 22)"))
        : Deno.stat(path),
    readDirectory: (path) =>
      path === join(f.root, "blocked")
        ? Promise.reject(new TypeError("Invalid argument (os error 22)"))
        : Array.fromAsync(Deno.readDir(path)),
    readTextFile: (path) =>
      path === join(f.root, "unreadable.ts")
        ? Promise.reject(new TypeError("Invalid argument (os error 22)"))
        : Deno.readTextFile(path),
  });
  try {
    assertEquals(
      await new SymbolCatalog(f.root, {}, access).targets(),
      new Map([["visible", "/visible.ts#symbol-visible"]]),
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
