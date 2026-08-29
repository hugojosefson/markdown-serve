import { assertEquals } from "@std/assert";
import {
  ActiveFilePoller,
  fileRevision,
} from "../src/server/active-file-poller.ts";

function info(overrides: Partial<Deno.FileInfo> = {}): Deno.FileInfo {
  return {
    isFile: true,
    isDirectory: false,
    isSymlink: false,
    size: 1,
    mtime: new Date(1),
    ctime: new Date(1),
    atime: null,
    birthtime: null,
    dev: 1,
    ino: 1,
    mode: null,
    nlink: null,
    uid: null,
    gid: null,
    rdev: null,
    blksize: null,
    blocks: null,
    isBlockDevice: false,
    isCharDevice: false,
    isFifo: false,
    isSocket: false,
    ...overrides,
  };
}

Deno.test("active file poller deduplicates paths and stops with no clients", async () => {
  let stats = 0;
  let changes = 0;
  const stat = () => {
    stats++;
    return Promise.resolve(info());
  };
  const poller = new ActiveFilePoller(() => changes++, stat, 60_000);
  const revision = fileRevision(info());
  const removeOne = poller.track("/file", revision);
  const removeTwo = poller.track("/file", revision);
  await poller.check();
  assertEquals([stats, changes], [1, 0]);
  await poller.check();
  assertEquals([stats, changes], [2, 0]);
  removeOne();
  await poller.check();
  assertEquals(stats, 3);
  removeTwo();
  await poller.check();
  assertEquals(stats, 3);
  poller.close();
});

Deno.test("active file poller detects replacement and deletion", async () => {
  let current: Deno.FileInfo | "missing" = info();
  let changes = 0;
  const poller = new ActiveFilePoller(
    () => changes++,
    () => {
      if (current === "missing") throw new Deno.errors.NotFound();
      return Promise.resolve(current);
    },
    60_000,
  );
  const remove = poller.track("/file", fileRevision(current));
  await poller.check();
  current = info({ ino: 2, size: 2 });
  await poller.check();
  current = "missing";
  await poller.check();
  assertEquals(changes, 2);
  remove();
  poller.close();
});

Deno.test("active file poller detects a render-to-connect race", async () => {
  let changes = 0;
  const current = info({ size: 2, mtime: new Date(2) });
  const poller = new ActiveFilePoller(
    () => changes++,
    () => Promise.resolve(current),
    60_000,
  );
  const remove = poller.track("/file", fileRevision(info()));
  await poller.check();
  assertEquals(changes, 1);
  remove();
  poller.close();
});

Deno.test("active file poller reloads a stale duplicate client", async () => {
  let changes = 0;
  const current = info({ size: 2 });
  const poller = new ActiveFilePoller(
    () => changes++,
    () => Promise.resolve(current),
    60_000,
  );
  const currentRevision = fileRevision(current);
  const removeCurrent = poller.track("/file", currentRevision);
  await poller.check();
  const removeStale = poller.track("/file", fileRevision(info()));
  assertEquals(changes, 1);
  removeCurrent();
  removeStale();
  poller.close();
});

Deno.test("active file poller detects access changes and continues", async () => {
  let denied = true;
  let changes = 0;
  const initial = info();
  const poller = new ActiveFilePoller(
    () => changes++,
    (path) => {
      if (path === "/denied" && denied) {
        throw new Deno.errors.PermissionDenied();
      }
      return Promise.resolve(path === "/changed" ? info({ size: 2 }) : initial);
    },
    60_000,
  );
  const deniedRemove = poller.track("/denied", fileRevision(initial));
  const changedRemove = poller.track("/changed", fileRevision(initial));
  await poller.check();
  assertEquals(changes, 2);
  denied = false;
  await poller.check();
  assertEquals(changes, 3);
  deniedRemove();
  changedRemove();
  poller.close();
});
