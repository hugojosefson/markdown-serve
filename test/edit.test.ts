import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import { parseArgs } from "../src/cli/parse-args.ts";
import { assertServePermissions } from "../src/cli/capabilities.ts";
import {
  atomicReplace,
  EditConflict,
  type EditFileSystem,
  editLimit,
} from "../src/server/edit-response.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("editing is opt-in and requires a root-scoped write grant", () => {
  assertEquals(parseArgs([]).edit, false);
  assertEquals(parseArgs(["--edit"]).edit, true);
  const query = (descriptor: Deno.PermissionDescriptor) =>
    ({
      state: descriptor.name === "write" ? "denied" : "granted",
    }) as Pick<Deno.PermissionStatus, "state">;
  try {
    assertServePermissions(
      ".",
      "localhost",
      8000,
      false,
      query,
      () => {},
      true,
    );
    throw new Error("expected write denial");
  } catch (error) {
    assertMatch(String(error), /grant --allow-write=/);
  }
});

Deno.test({
  name:
    "programmatic editing requires write permission but read-only serving does not",
  permissions: { read: true, write: false, run: false },
  async fn() {
    await handler(Deno.cwd(), { git: false });
    await assertRejects(
      () => handler(Deno.cwd(), { edit: true, git: false }),
      Error,
      `grant --allow-write=${Deno.cwd()}`,
    );
  },
});

Deno.test("edit endpoint supplies read headers and rejects unsafe writes", async () => {
  const f = await fixture({ "note.txt": "first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const get = await on(new Request(url));
    assertEquals(
      [
        get.status,
        get.headers.get("content-type"),
        get.headers.get("content-length"),
        await get.text(),
      ],
      [200, "text/plain; charset=UTF-8", "6", "first\n"],
    );
    const head = await on(new Request(url, { method: "HEAD" }));
    assertEquals([
      head.status,
      await head.text(),
      head.headers.get("etag") === null,
    ], [200, "", false]);
    const unsafeHeaders: [Record<string, string>, number][] = [
      [{}, 403],
      [{
        Origin: "http://elsewhere",
        "If-Match": '"x"',
        "Content-Type": "text/plain; charset=UTF-8",
      }, 403],
      [
        { Origin: "http://x", "Content-Type": "text/plain; charset=UTF-8" },
        428,
      ],
      [{
        Origin: "http://x",
        "If-Match": '"x"',
        "Content-Type": "application/json",
      }, 415],
      [{
        Origin: "http://x",
        "If-Match": '"x"',
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Length": "bad",
      }, 413],
    ];
    for (const [headers, status] of unsafeHeaders) {
      const result = await on(
        new Request(url, { method: "PUT", headers, body: "x" }),
      );
      assertEquals(result.status, status);
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit controls expose only eligible files and preserve index paths", async () => {
  const f = await fixture({
    "note.txt": "text\n",
    "docs/README.md": "# Docs\n",
    "binary.bin": "binary",
  });
  try {
    await Deno.writeFile(`${f.root}/binary.bin`, new Uint8Array([0, 1]));
    const off = await handler(f.root);
    assertEquals(
      (await (await off(new Request("http://x/note.txt"))).text()).includes(
        "edit-file",
      ),
      false,
    );
    const on = await handler(f.root, { edit: true });
    assertMatch(
      await (await on(new Request("http://x/note.txt"))).text(),
      /data-edit-path="note\.txt"/,
    );
    assertMatch(
      await (await on(new Request("http://x/docs/"))).text(),
      /data-edit-path="docs\/README\.md"/,
    );
    for (const path of ["binary.bin", "missing.txt"]) {
      assertEquals(
        (await on(
          new Request(
            `http://x/__markdown_serve__/edit?path=${encodeURIComponent(path)}`,
          ),
        )).status,
        404,
      );
    }
  } finally {
    await f.cleanup();
  }
});

Deno.test("edit endpoint rejects non-text and oversized bodies", async () => {
  const f = await fixture({ "note.txt": "text\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const tag = (await on(new Request(url))).headers.get("etag")!;
    const request = (body: BodyInit) =>
      new Request(url, {
        method: "PUT",
        headers: {
          Origin: "http://x",
          "Content-Type": "text/plain; charset=UTF-8",
          "If-Match": tag,
        },
        body,
      });
    assertEquals(
      (await on(request(new Uint8Array([0])))).status,
      400,
    );
    assertEquals(
      (await on(request(new Uint8Array(editLimit + 1)))).status,
      413,
    );
    assertEquals(await Deno.readTextFile(`${f.root}/note.txt`), "text\n");
  } finally {
    await f.cleanup();
  }
});

Deno.test({
  name:
    "editing rejects links, directories, large files, and late invalid UTF-8",
  ignore: Deno.build.os === "windows",
  async fn() {
    const f = await fixture({
      "note.txt": "text\n",
      "directory/inside.txt": "inside\n",
      "large.txt": "x".repeat(editLimit + 1),
    });
    try {
      await Deno.symlink("note.txt", `${f.root}/link.txt`);
      await Deno.writeFile(
        `${f.root}/invalid.txt`,
        new Uint8Array([...new Uint8Array(9_000).fill(0x61), 0xff]),
      );
      const on = await handler(f.root, { edit: true });
      for (
        const path of [
          "link.txt",
          "directory",
          "large.txt",
          "invalid.txt",
        ]
      ) {
        assertEquals(
          (await on(
            new Request(
              `http://x/__markdown_serve__/edit?path=${path}`,
            ),
          )).status,
          404,
        );
      }
      assertEquals(
        (await (await on(new Request("http://x/link.txt"))).text()).includes(
          "edit-file",
        ),
        false,
      );
    } finally {
      await f.cleanup();
    }
  },
});

Deno.test("concurrent editor writes permit only one matching version", async () => {
  const f = await fixture({ "note.txt": "first\n" });
  try {
    const on = await handler(f.root, { edit: true });
    const url = "http://x/__markdown_serve__/edit?path=note.txt";
    const tag = (await on(new Request(url))).headers.get("etag")!;
    const put = (body: string) =>
      on(
        new Request(url, {
          method: "PUT",
          headers: {
            Origin: "http://x",
            "Content-Type": "text/plain; charset=UTF-8",
            "If-Match": tag,
          },
          body,
        }),
      );
    const statuses = (await Promise.all([put("one\n"), put("two\n")]))
      .map((response) => response.status).toSorted();
    assertEquals(statuses, [204, 412]);
    assertEquals(
      ["one\n", "two\n"].includes(
        await Deno.readTextFile(`${f.root}/note.txt`),
      ),
      true,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("atomic replacement handles partial writes, modes, cleanup, and directory sync", async () => {
  const writes: number[] = [];
  const calls: string[] = [];
  let temp = "";
  const fs: EditFileSystem = {
    ...Deno,
    stat: () => Promise.resolve(({ mode: 0o640 }) as Deno.FileInfo),
    open: (path) => {
      temp = String(path);
      return Promise.resolve({
        write: (bytes: Uint8Array) => {
          writes.push(bytes.length);
          return Promise.resolve(Math.min(1, bytes.length));
        },
        sync: () => {
          calls.push("sync");
          return Promise.resolve();
        },
        close: () => {
          calls.push("close");
        },
      } as unknown as Deno.FsFile);
    },
    chmod: () => {
      calls.push("chmod");
      return Promise.resolve();
    },
    rename: () => {
      calls.push("rename");
      return Promise.resolve();
    },
    remove: (path) => {
      assertEquals(path, temp);
      calls.push("remove");
      return Promise.resolve();
    },
    syncDirectory: () => {
      calls.push("directory");
      return Promise.resolve();
    },
  };
  await atomicReplace("/root/note.txt", new Uint8Array([1, 2]), fs);
  assertEquals(writes, [2, 1]);
  assertEquals(calls, [
    "sync",
    "close",
    "chmod",
    "rename",
    "directory",
    "remove",
  ]);

  const failed = {
    ...fs,
    rename: () => Promise.reject(new Error("rename")),
  };
  await assertRejects(() =>
    atomicReplace("/root/note.txt", new Uint8Array([1]), failed)
  );
  assertEquals(calls.includes("remove"), true);

  const changed = {
    ...fs,
    lstat: () =>
      Promise.resolve({ isFile: true, isSymlink: false } as Deno.FileInfo),
    readFile: () => Promise.resolve(new TextEncoder().encode("changed")),
  };
  await assertRejects(
    () =>
      atomicReplace(
        "/root/note.txt",
        new Uint8Array([1]),
        changed,
        '"stale"',
      ),
    EditConflict,
  );
});

Deno.test("edit endpoint is disabled by default and atomically saves versioned text", async () => {
  const f = await fixture({ "note.txt": "first\n", "binary.bin": "x" });
  try {
    await Deno.writeFile(`${f.root}/binary.bin`, new Uint8Array([0, 1]));
    const off = await handler(f.root);
    assertEquals(
      (await off(new Request("http://x/__markdown_serve__/edit?path=note.txt")))
        .status,
      404,
    );
    const on = await handler(f.root, { edit: true });
    if (Deno.build.os !== "windows") {
      await Deno.chmod(`${f.root}/note.txt`, 0o640);
    }
    const get = await on(
      new Request("http://x/__markdown_serve__/edit?path=note.txt"),
    );
    const tag = get.headers.get("etag")!;
    assertEquals(await get.text(), "first\n");
    const put = await on(
      new Request("http://x/__markdown_serve__/edit?path=note.txt", {
        method: "PUT",
        headers: {
          Origin: "http://x",
          "Content-Type": "text/plain; charset=UTF-8",
          "If-Match": tag,
        },
        body: "second\n",
      }),
    );
    assertEquals(put.status, 204);
    assertEquals(await Deno.readTextFile(`${f.root}/note.txt`), "second\n");
    if (Deno.build.os !== "windows") {
      assertEquals(
        (await Deno.stat(`${f.root}/note.txt`)).mode! & 0o777,
        0o640,
      );
    }
    assertEquals(
      (await Array.fromAsync(Deno.readDir(f.root))).some((entry) =>
        entry.name.startsWith(".markdown-serve-")
      ),
      false,
    );
    assertEquals(
      (await on(
        new Request("http://x/__markdown_serve__/edit?path=note.txt", {
          method: "PUT",
          headers: {
            Origin: "http://x",
            "Content-Type": "text/plain; charset=UTF-8",
            "If-Match": tag,
          },
          body: "lost",
        }),
      )).status,
      412,
    );
    for (const path of ["../note.txt", "binary.bin", "missing.txt"]) {
      assertEquals(
        (await on(
          new Request(
            `http://x/__markdown_serve__/edit?path=${encodeURIComponent(path)}`,
          ),
        )).status,
        404,
      );
    }
    assertEquals(
      (await on(
        new Request("http://x/__markdown_serve__/edit?path=note.txt", {
          method: "POST",
        }),
      )).headers.get("allow"),
      "GET, HEAD, PUT",
    );
  } finally {
    await f.cleanup();
  }
});
