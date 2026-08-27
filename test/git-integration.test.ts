import { assertEquals, assertRejects } from "@std/assert";
import { join } from "@std/path";
import { runGit } from "../src/server/git/command.ts";
import { createGitState } from "../src/server/git/state.ts";
import { fixture } from "./fixture.ts";

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
