import { assertEquals, assertMatch, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { runGit } from "../src/server/git/command.ts";
import { createGitState } from "../src/server/git/state.ts";
import { GitResolver } from "../src/server/git/resolver.ts";
import { fixture, handler } from "./fixture.ts";

async function git(root: string, args: string[]): Promise<void> {
  const result = await runGit(root, args);
  if (!result.success) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
}

async function repository(files: Record<string, string>) {
  const f = await fixture(files);
  await git(f.root, ["init", "--initial-branch=main"]);
  await git(f.root, ["add", "."]);
  await git(f.root, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "-m",
    "initial commit",
  ]);
  return f;
}

Deno.test("Git state refreshes after reload invalidation and combines real staged and unstaged diffs", async () => {
  const f = await repository({ "tracked.md": "one\ntwo\nthree\n" });
  let reload: (() => void | Promise<void>) | undefined;
  const reloadSource = {
    subscribe(listener: () => void | Promise<void>) {
      reload = listener;
      return () => {};
    },
  };
  try {
    const state = await createGitState(f.root, reloadSource, 60_000);
    assertEquals((await state?.status())?.files, []);

    await Deno.writeTextFile(join(f.root, "tracked.md"), "one\nTWO\nthree\n");
    await git(f.root, ["add", "tracked.md"]);
    await Deno.writeTextFile(join(f.root, "tracked.md"), "one\nTWO\nTHREE\n");
    if (!reload) {
      throw new Error("Git state did not subscribe to reloads");
    }
    await reload();

    const status = await state?.status();
    assertEquals(
      status?.files.map((file) => [file.path, file.index, file.worktree]),
      [
        ["tracked.md", "M", "M"],
      ],
    );
    assertEquals([...await state?.diff("tracked.md", 3) ?? []], [
      [2, { staged: true, deletions: 1 }],
      [3, { unstaged: true, deletions: 1 }],
    ]);
    assertEquals(await state?.head("tracked.md"), "one\ntwo\nthree\n");
  } finally {
    await f.cleanup();
  }
});

Deno.test("editor Git hunks inspect and revert a draft without writing", async () => {
  const f = await repository({ "guide.md": "# head\n" });
  try {
    await Deno.writeTextFile(join(f.root, "guide.md"), "# disk\n");
    const on = await handler(f.root, { edit: true, git: true });
    const preview = async (draft: string, revert = "") => {
      const response = await on(
        new Request(
          `http://x/__markdown_serve__/highlight?path=guide.md${revert}`,
          {
            method: "POST",
            headers: {
              Origin: "http://x",
              "Content-Type": "text/plain; charset=UTF-8",
            },
            body: draft,
          },
        ),
      );
      assertEquals(response.status, 200);
      return await response.json() as {
        draft: string;
        git: boolean;
        html: string;
        hunks: Array<{ start: number; count: number; text: string }>;
      };
    };
    const changed = await preview("# editor\n");
    assertEquals(changed.git, true);
    assertEquals(changed.hunks.length, 1);
    assertMatch(changed.hunks[0].text, /-# head[\s\S]*\+# editor/);
    assertMatch(changed.html, /token/);

    const reverted = await preview("# editor\n", "&revert=0");
    assertEquals([reverted.draft, reverted.hunks], ["# head\n", []]);
    assertEquals(await Deno.readTextFile(join(f.root, "guide.md")), "# disk\n");
  } finally {
    await f.cleanup();
  }
});

Deno.test("Git state is unavailable outside repositories", async () => {
  const f = await fixture({ "plain.md": "text" });
  try {
    assertEquals(await createGitState(f.root), undefined);
  } finally {
    await f.cleanup();
  }
});

Deno.test("negative Git discovery expires without a reload source", async () => {
  const f = await fixture({ "plain.md": "text" });
  try {
    const resolver = new GitResolver(f.root, undefined, 1);
    assertEquals(await resolver.state(f.root), undefined);
    await git(f.root, ["init", "--initial-branch=main"]);
    await new Promise((resolve) => setTimeout(resolve, 2));
    assertEquals((await resolver.state(f.root))?.repositoryRoot, f.root);
    await Deno.remove(join(f.root, ".git"), { recursive: true });
    await new Promise((resolve) => setTimeout(resolve, 2));
    assertEquals(await resolver.state(f.root), undefined);
  } finally {
    await f.cleanup();
  }
});

Deno.test("reload rediscovery adds and removes a served-root repository", async () => {
  const f = await fixture({ "guide.md": "before\n" });
  const listeners = new Set<() => void | Promise<void>>();
  const reloadSource = {
    subscribe(listener: () => void | Promise<void>) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const reload = async () => {
    for (const listener of listeners) await listener();
  };
  try {
    const on = await handler(f.root, { git: true, reloadSource });
    assertEquals(
      (await (await on(new Request("http://x/"))).text()).includes(
        "repo-context",
      ),
      false,
    );

    await git(f.root, ["init", "--initial-branch=main"]);
    await git(f.root, ["add", "."]);
    await git(f.root, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await Deno.writeTextFile(join(f.root, "guide.md"), "after\n");
    await reload();

    assertMatch(
      await (await on(new Request("http://x/"))).text(),
      /repo-context/,
    );
    assertMatch(
      await (await on(new Request("http://x/guide?source"))).text(),
      /data-git-change="unstaged"/,
    );

    await Deno.remove(join(f.root, ".git"), { recursive: true });
    await reload();
    assertEquals(
      (await (await on(new Request("http://x/"))).text()).includes(
        "repo-context",
      ),
      false,
    );
    assertEquals(
      (await (await on(new Request("http://x/guide?source"))).text()).includes(
        "data-git-change",
      ),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("nested repository discovery maps status and diffs to the served root", async () => {
  const f = await fixture({ "child/guide.md": "before\n" });
  const listeners = new Set<() => void | Promise<void>>();
  const reloadSource = {
    subscribe(listener: () => void | Promise<void>) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const reload = async () => {
    for (const listener of listeners) await listener();
  };
  const child = join(f.root, "child");
  try {
    const on = await handler(f.root, { edit: true, git: true, reloadSource });
    await git(child, ["init", "--initial-branch=main"]);
    await git(child, ["add", "."]);
    await git(child, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await Deno.writeTextFile(join(child, "guide.md"), "after\n");
    await reload();

    assertMatch(
      await (await on(new Request("http://x/child/"))).text(),
      /repo-context/,
    );
    assertMatch(
      await (await on(new Request("http://x/"))).text(),
      /<a href="child\/\?dir"[^>]*>child\/<\/a><\/td><td class="directory-git"><span data-git-kind="modified"[^>]*>M<\/span>/,
    );
    assertMatch(
      await (await on(new Request("http://x/child/guide?source"))).text(),
      /data-git-change="unstaged"/,
    );
    const highlight = await on(
      new Request("http://x/__markdown_serve__/highlight?path=child/guide.md", {
        method: "POST",
        headers: {
          Origin: "http://x",
          "Content-Type": "text/plain; charset=UTF-8",
        },
        body: "editor\n",
      }),
    );
    assertEquals((await highlight.json() as { git: boolean }).git, true);

    await Deno.remove(join(child, ".git"), { recursive: true });
    await reload();
    assertEquals(
      (await (await on(new Request("http://x/child/"))).text()).includes(
        "repo-context",
      ),
      false,
    );
    assertEquals(
      (await (await on(new Request("http://x/child/guide?source"))).text())
        .includes("data-git-change"),
      false,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("nested repository status overrides an outer untracked directory", async () => {
  const f = await repository({ "outer.md": "outer\n" });
  const child = join(f.root, "child");
  try {
    await Deno.mkdir(child);
    await Deno.writeTextFile(join(child, "guide.md"), "before\n");
    await git(child, ["init", "--initial-branch=main"]);
    await git(child, ["add", "."]);
    await git(child, [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "initial",
    ]);
    await Deno.writeTextFile(join(child, "guide.md"), "after\n");
    const body = await (await (await handler(f.root, { git: true }))(
      new Request("http://x/"),
    )).text();
    assertMatch(
      body,
      /<a href="child\/\?dir"[^>]*>child\/<\/a><\/td><td class="directory-git"><span data-git-kind="modified"[^>]*>M<\/span>/,
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test("Git state clears cached status when its repository disappears", async () => {
  const f = await repository({ "tracked.md": "text\n" });
  try {
    const state = await createGitState(f.root, undefined, 60_000);
    assertEquals((await state?.status())?.files, []);
    await Deno.remove(join(f.root, ".git"), { recursive: true });
    await state?.refresh();
    assertEquals(await state?.status(), undefined);
  } finally {
    await f.cleanup();
  }
});

Deno.test("Git HEAD reads are served-root-relative and recognize untracked files", async () => {
  const f = await repository({ "served/tracked.md": "tracked\n" });
  try {
    const served = join(f.root, "served");
    const state = await createGitState(served, undefined, 60_000);
    assertEquals(await state?.head("tracked.md"), "tracked\n");
    await Deno.writeTextFile(join(served, "tracked.md"), "changed\n");
    await state?.refresh();
    assertEquals(
      (await state?.status())?.files.map((file) => file.path),
      ["tracked.md"],
    );
    assertEquals([...await state?.diff("tracked.md", 1) ?? []], [
      [1, { unstaged: true, deletions: 1 }],
    ]);
    await Deno.writeTextFile(join(served, "new.md"), "new\n");
    await state?.refresh();
    assertEquals(await state?.head("new.md"), "");
    assertEquals(await state?.head("../tracked.md"), undefined);
  } finally {
    await f.cleanup();
  }
});

Deno.test("Git commands enforce the configured output cap", async () => {
  const f = await repository({ "tracked.md": "text" });
  try {
    await assertRejects(
      () => runGit(f.root, ["log", "--format=%B"], { maxOutputBytes: 1 }),
      Error,
      "git stdout exceeded output limit",
    );
    await assertRejects(
      () =>
        runGit(Deno.cwd(), ["not-a-command-with-a-long-name"], {
          maxOutputBytes: 1,
        }),
      Error,
      "git stderr exceeded output limit",
    );
  } finally {
    await f.cleanup();
  }
});

Deno.test({
  name: "Git commands enforce the configured timeout",
  ignore: Deno.build.os === "windows",
  fn: async () => {
    await assertRejects(
      () =>
        runGit(Deno.cwd(), [
          "-c",
          "alias.wait=!sleep 1",
          "wait",
        ], { timeoutMs: 20 }),
      Error,
      "git command timed out",
    );
  },
});

Deno.test({
  name: "Git state is unavailable when Git execution is denied",
  permissions: { run: false },
  fn: async () => {
    assertEquals(await createGitState(Deno.cwd()), undefined);
  },
});
