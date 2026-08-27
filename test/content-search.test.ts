import { assertEquals, assertRejects } from "@std/assert";
import {
  contentSearchOptions,
  createRgRunner,
  parseRgOutput,
  rgArgs,
  SearchUnavailable,
} from "../src/server/content-search.ts";
import { fixture, handler } from "./fixture.ts";

Deno.test("repository search is scoped, injected, and links source lines", async () => {
  const f = await fixture({ "docs/a.txt": "x", "outside.txt": "x" });
  try {
    let scope = "";
    const h = await handler(f.root, {
      contentSearchRunner: (value) => {
        scope = value;
        return Promise.resolve([{
          path: "a.txt",
          line: 3,
          text: "<safe>",
          context: [],
          href: "",
        }]);
      },
    });
    const response = await h(
      new Request(
        "http://x/__markdown_serve__/search?path=docs&search=x&fixed=1",
      ),
    );
    assertEquals(scope, `${f.root}/docs`);
    assertEquals(await response.json(), [{
      path: "a.txt",
      line: 3,
      text: "<safe>",
      context: [],
      href: "/docs/a.txt#L3",
    }]);
    assertEquals(
      (await h(
        new Request("http://x/__markdown_serve__/search?path=..&search=x"),
      )).status,
      400,
    );
    assertEquals(
      (await h(
        new Request("http://x/__markdown_serve__/search?path=docs&search=x", {
          method: "HEAD",
        }),
      )).status,
      200,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("repository search parses bounded rg JSON and safe options", () => {
  assertEquals(
    parseRgOutput(
      new TextEncoder().encode(
        '{"type":"match","data":{"path":{"text":"a.txt"},"line_number":2,"lines":{"text":"ok\\n"}}}\n',
      ),
    ),
    [{ path: "a.txt", line: 2, text: "ok", context: [], href: "" }],
  );
  assertEquals(
    contentSearchOptions(new URLSearchParams("search=x&context=9")),
    undefined,
  );
  assertEquals(
    contentSearchOptions(new URLSearchParams("search=x&context=")),
    undefined,
  );
  assertEquals(
    contentSearchOptions(new URLSearchParams("search=--evil&fixed=1"))?.query,
    "--evil",
  );
  assertEquals(
    parseRgOutput(
      new TextEncoder().encode(
        [
          '{"type":"context","data":{"path":{"text":"a.txt"},"line_number":1,"lines":{"text":"before\\n"}}}',
          '{"type":"match","data":{"path":{"text":"a.txt"},"line_number":2,"lines":{"text":"match\\n"}}}',
          '{"type":"context","data":{"path":{"text":"a.txt"},"line_number":3,"lines":{"text":"after\\n"}}}',
          '{"type":"context","data":{"path":{"text":"other.txt"},"line_number":2,"lines":{"text":"other\\n"}}}',
        ].join("\n"),
      ),
    ),
    [{
      path: "a.txt",
      line: 2,
      text: "match",
      context: [
        { line: 1, text: "before" },
        { line: 3, text: "after" },
      ],
      href: "",
    }],
  );
});

Deno.test("rg runner pre-abort, spawn failure, status, and argument boundaries", async () => {
  const options = contentSearchOptions(
    new URLSearchParams(
      "search=--evil&fixed=1&hidden=1&ignored=1&glob=*.ts&type=ts&context=2",
    ),
  )!;
  const args = rgArgs(options);
  assertEquals(args.at(args.indexOf("--") + 1), "--evil");
  const aborted = new AbortController();
  aborted.abort();
  let spawned = false;
  await createRgRunner(() => {
    spawned = true;
    throw new Error();
  })(".", options, aborted.signal).catch((error) =>
    assertEquals(error instanceof SearchUnavailable, true)
  );
  assertEquals(spawned, false);
  await createRgRunner(() => {
    throw new Error();
  })(".", options).catch((error) =>
    assertEquals(error instanceof SearchUnavailable, true)
  );
  const stream = (text: string) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    });
  const noMatches = await createRgRunner(() => ({
    stdout: stream(""),
    stderr: stream(""),
    status: Promise.resolve({ success: false, code: 1, signal: null }),
    kill() {},
  }))(".", options);
  assertEquals(noMatches, []);
});

Deno.test("rg runner kills, reaps, caps output, aborts, fails, and parses", async () => {
  const options = contentSearchOptions(new URLSearchParams("search=x"))!;
  const encoder = new TextEncoder();
  const stream = (text: string, open = false) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        if (text) controller.enqueue(encoder.encode(text));
        if (!open) controller.close();
      },
    });
  const child = (
    stdout: ReadableStream<Uint8Array>,
    stderr: ReadableStream<Uint8Array>,
    code = 0,
  ) => {
    let reap!: () => void;
    const status = new Promise<Deno.CommandStatus>((resolve) =>
      reap = () => resolve({ success: code === 0, code, signal: null })
    );
    let killed = 0;
    return {
      stdout,
      stderr,
      status,
      kill() {
        killed++;
        reap();
      },
      get killed() {
        return killed;
      },
    };
  };
  const timeout = child(stream("", true), stream("", true));
  await assertRejects(
    () =>
      createRgRunner(() => timeout, {
        timeoutMilliseconds: 1,
        outputBytes: 20,
      })(".", options),
    SearchUnavailable,
  );
  assertEquals(timeout.killed, 1);
  const stdout = child(stream("x".repeat(21)), stream(""));
  await assertRejects(
    () =>
      createRgRunner(() => stdout, {
        timeoutMilliseconds: 100,
        outputBytes: 20,
      })(".", options),
    SearchUnavailable,
  );
  assertEquals(stdout.killed, 1);
  const stderr = child(stream(""), stream("x".repeat(21)));
  await assertRejects(
    () =>
      createRgRunner(() => stderr, {
        timeoutMilliseconds: 100,
        outputBytes: 20,
      })(".", options),
    SearchUnavailable,
  );
  assertEquals(stderr.killed, 1);
  const active = child(stream("", true), stream("", true));
  const abort = new AbortController();
  const pending = createRgRunner(() => active, {
    timeoutMilliseconds: 100,
    outputBytes: 20,
  })(".", options, abort.signal);
  abort.abort();
  await assertRejects(() => pending, SearchUnavailable);
  assertEquals(active.killed, 1);
  await assertRejects(
    () =>
      createRgRunner(() => ({
        ...child(stream(""), stream(""), 2),
        status: Promise.resolve({ success: false, code: 2, signal: null }),
      }))(".", options),
    SearchUnavailable,
  );
  const parsed = await createRgRunner(() => ({
    ...child(
      stream(
        '{"type":"match","data":{"path":{"text":"a.txt"},"line_number":2,"lines":{"text":"ok\\n"}}}\n',
      ),
      stream(""),
    ),
    status: Promise.resolve({ success: true, code: 0, signal: null }),
  }))(".", options);
  assertEquals(parsed, [{
    path: "a.txt",
    line: 2,
    text: "ok",
    context: [],
    href: "",
  }]);
});

Deno.test("repository search endpoint validates options and result boundaries", async () => {
  const f = await fixture({
    "docs/a.md": "x",
    "docs/README.md": "x",
    "docs/index.md": "x",
  });
  try {
    const values = Array.from(
      { length: 101 },
      (_, index) => ({
        path: index === 0
          ? "a.md"
          : index === 1
          ? "README.md"
          : index === 2
          ? "index.md"
          : "README.md",
        line: index + 1,
        text: "x",
        context: [],
        href: "",
      }),
    );
    const h = await handler(f.root, {
      contentSearchRunner: () => Promise.resolve(values),
    });
    const endpoint = "http://x/__markdown_serve__/search?path=docs&search=x";
    const post = await h(new Request(endpoint, { method: "POST" }));
    assertEquals([post.status, post.headers.get("allow")], [405, "GET, HEAD"]);
    const head = await h(new Request(endpoint, { method: "HEAD" }));
    assertEquals([await head.text(), head.headers.get("content-type")], [
      "",
      "application/json; charset=utf-8",
    ]);
    const response = await h(new Request(endpoint));
    const result = await response.json() as { href: string }[];
    assertEquals(result.length, 100);
    assertEquals(result[0].href, "/docs/a?source#L1");
    assertEquals([result[1].href, result[2].href], [
      "/docs/?source#L2",
      "/docs/?source#L3",
    ]);
    for (
      const query of [
        "",
        "x".repeat(501),
        "x&context=no",
        "x&context=-1",
        "x&context=9",
        "x&context=1.5",
        "x&fixed=no",
        "x&smartCase=2",
        "x&hidden=yes",
        "x&ignored=true",
        "x&glob=",
        "x&type=",
        `x&glob=${"x".repeat(101)}`,
        `x&type=${"x".repeat(101)}`,
      ]
    ) {
      assertEquals(
        (await h(
          new Request(`${endpoint.replace("search=x", `search=${query}`)}`),
        )).status,
        400,
      );
    }
    const unavailable = await handler(f.root, {
      contentSearchRunner: () => Promise.reject(new Error()),
    });
    assertEquals((await unavailable(new Request(endpoint))).status, 503);
    const unsafe = await handler(f.root, {
      contentSearchRunner: () =>
        Promise.resolve([{
          path: "../outside",
          line: 1,
          text: "x",
          context: [],
          href: "",
        }, { path: ".\\a.md", line: 2, text: "x", context: [], href: "" }]),
    });
    assertEquals(await (await unsafe(new Request(endpoint))).json(), [{
      path: "a.md",
      line: 2,
      text: "x",
      context: [],
      href: "/docs/a?source#L2",
    }]);
  } finally {
    await f.cleanup();
  }
});

Deno.test({
  name: "repository search rejects symlink escapes",
  ignore: Deno.build.os === "windows",
  async fn() {
    const f = await fixture({ "docs/a.txt": "x", "outside.txt": "x" });
    const outside = await Deno.makeTempDir();
    try {
      await Deno.writeTextFile(`${outside}/escape.txt`, "x");
      await Deno.symlink(`${outside}/escape.txt`, `${f.root}/docs/escape.txt`);
      const h = await handler(f.root, {
        contentSearchRunner: () =>
          Promise.resolve([{
            path: "escape.txt",
            line: 1,
            text: "x",
            context: [],
            href: "",
          }]),
      });
      assertEquals(
        await (await h(
          new Request("http://x/__markdown_serve__/search?path=docs&search=x"),
        )).json(),
        [],
      );
    } finally {
      await f.cleanup();
      await Deno.remove(outside, { recursive: true });
    }
  },
});
