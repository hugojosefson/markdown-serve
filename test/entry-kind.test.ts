import { assertEquals } from "@std/assert";
import { entryKind } from "../src/server/entry-kind.ts";

const entry = (
  name: string,
  directory = false,
  symlink = false,
  mode?: number,
) =>
  ({
    name,
    directory,
    symlink,
    info: mode === undefined ? undefined : { mode },
  }) as unknown as Parameters<typeof entryKind>[0];

Deno.test("entry kinds prefer symlinks and classify common groups", () => {
  assertEquals(entryKind(entry("folder", true, true)), "symlink");
  assertEquals(entryKind(entry("folder", true)), "directory");
  assertEquals(entryKind(entry("run", false, false, 0o755)), "executable");
  assertEquals(entryKind(entry("release.tar")), "archive");
  assertEquals(entryKind(entry("cover.png")), "image");
  assertEquals(entryKind(entry("clip.webm")), "media");
  assertEquals(entryKind(entry("notes.txt")), "file");
});
