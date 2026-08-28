import { assert, assertEquals } from "@std/assert";
import { join, resolve } from "@std/path";
import { FileAccess } from "../src/server/file-access.ts";

const denied = new Deno.errors.PermissionDenied("denied");

Deno.test("file access warns once and suppresses denied directory descendants", () => {
  const warnings: string[] = [];
  const access = new FileAccess("/root", (warning) => warnings.push(warning));
  assert(access.handlePermissionDenied("/root/private", denied, true));
  assert(access.handlePermissionDenied("/root/private/nested/file", denied));
  assert(access.handlePermissionDenied("/root/private", denied, true));
  assertEquals(warnings, ["Cannot access private: permission denied"]);
});

Deno.test("file access rejects root permission denial", () => {
  const access = new FileAccess("/root", () => assert(false));
  assertEquals(access.handlePermissionDenied("/root", denied, true), false);
});

Deno.test("file access short-circuits descendants after a denied directory read", async () => {
  let reads = 0;
  const access = new FileAccess("/root", () => {}, {
    readDirectory: () => {
      reads++;
      return Promise.reject(new Deno.errors.PermissionDenied("denied"));
    },
    readTextFile: () => {
      reads++;
      return Promise.reject(new Error("must not read descendant"));
    },
  });
  assertEquals(await access.readDirectory("/root/blocked"), []);
  assertEquals(await access.readTextFile("/root/blocked/file.ts"), undefined);
  assertEquals(reads, 1);
});

Deno.test("a denied directory stat hint suppresses descendants", async () => {
  let reads = 0;
  const access = new FileAccess("/root", () => {}, {
    stat: () => Promise.reject(new Deno.errors.PermissionDenied("denied")),
    readTextFile: () => {
      reads++;
      return Promise.resolve("unexpected");
    },
  });
  assertEquals(await access.stat("/root/blocked", true), undefined);
  assertEquals(await access.readTextFile("/root/blocked/file.ts"), undefined);
  assertEquals(reads, 0);
});

Deno.test("file access does not warn for paths outside its root", () => {
  const warnings: string[] = [];
  const access = new FileAccess("/root", (warning) => warnings.push(warning));
  assertEquals(access.handlePermissionDenied("/elsewhere", denied), false);
  assertEquals(warnings, []);
});

Deno.test("file access handles descendants when the configured root is a filesystem root", () => {
  const root = resolve("/");
  const warnings: string[] = [];
  const access = new FileAccess(root, (warning) => warnings.push(warning));
  assert(access.handlePermissionDenied(join(root, "private"), denied, true));
  assertEquals(warnings, ["Cannot access private: permission denied"]);
});

Deno.test("clearing active denials retries access without repeating warnings", async () => {
  let deniedNow = true;
  let reads = 0;
  const warnings: string[] = [];
  const access = new FileAccess("/root", (warning) => warnings.push(warning), {
    readDirectory: () => {
      reads++;
      return deniedNow
        ? Promise.reject(new Deno.errors.PermissionDenied("denied"))
        : Promise.resolve([]);
    },
  });
  assertEquals(await access.readDirectory("/root/private"), []);
  assert(access.isDenied("/root/private/file"));
  access.clearDenied();
  assertEquals(access.isDenied("/root/private/file"), false);
  deniedNow = false;
  assertEquals(await access.readDirectory("/root/private"), []);
  assertEquals(reads, 2);
  assertEquals(warnings, ["Cannot access private: permission denied"]);
});

Deno.test("active file denials clear independently of warning history", () => {
  const warnings: string[] = [];
  const access = new FileAccess("/root", (warning) => warnings.push(warning));
  assert(access.handlePermissionDenied("/root/private.txt", denied));
  assert(access.isDenied("/root/private.txt"));
  assertEquals(access.isDenied("/root/private.txt/child"), false);
  access.clearDenied();
  assertEquals(access.isDenied("/root/private.txt"), false);
  assert(access.handlePermissionDenied("/root/private.txt", denied));
  assertEquals(warnings, ["Cannot access private.txt: permission denied"]);
});
