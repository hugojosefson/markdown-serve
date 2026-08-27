import { assertEquals, assertRejects } from "@std/assert";
import { fileStream } from "../src/server/responses.ts";

Deno.test("file streams close files when seeking or reading fails", async () => {
  let seekCloses = 0;
  const seekFailure = new Error("seek failed");
  const seekFile = {
    seek: () => Promise.reject(seekFailure),
    close: () => seekCloses++,
  } as unknown as Deno.FsFile;
  await assertRejects(
    () => fileStream(seekFile, 0, 1),
    Error,
    "seek failed",
  );
  assertEquals(seekCloses, 1);

  let readCloses = 0;
  const readFailure = new Error("read failed");
  const readFile = {
    seek: () => Promise.resolve(0),
    read: () => Promise.reject(readFailure),
    close: () => readCloses++,
  } as unknown as Deno.FsFile;
  const stream = await fileStream(readFile, 0, 1);
  await assertRejects(
    () => stream.getReader().read(),
    Error,
    "read failed",
  );
  assertEquals(readCloses, 1);
});
