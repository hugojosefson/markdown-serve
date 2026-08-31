import { assertEquals, assertMatch } from "@std/assert";
import { FileCatalog } from "../src/server/file-catalog.ts";
import { renderMarkdown } from "../src/server/render-markdown.ts";
import { renderText } from "../src/server/render-text.ts";
import { route } from "../src/server/route.ts";
import type { ServerConfig } from "../src/server/types.ts";
import { fixture } from "./fixture.ts";

Deno.test("text and Markdown source views use served-root-relative Git paths", async () => {
  const f = await fixture({
    "code.txt": "one\ntwo",
    "docs/README.md": "# Guide",
    "guide.md": "# Alias",
  });
  const paths: string[] = [];
  const config: ServerConfig = {
    rootPath: f.root,
    rootLabel: `${f.root}/`,
    redirectStatus: 302,
    catalog: new FileCatalog(),
    git: {
      root: f.root,
      repositoryRoot: f.root,
      subdirectory: "",
      worktree: true,
      status: () => Promise.resolve(undefined),
      diff: (path) => {
        paths.push(path);
        return Promise.resolve(new Map([[1, { unstaged: true }]]));
      },
      head: () => Promise.resolve(undefined),
      refresh: () => Promise.resolve(),
    },
  };
  try {
    await config.catalog.warmRoot(f.root);
    const text = await renderText(
      config,
      new Request("http://x/code.txt"),
      new URL("http://x/code.txt"),
      `${f.root}/code.txt`,
      ["code.txt"],
    );
    assertMatch(await text.text(), /data-git-change="unstaged"/);
    const source = await renderMarkdown(
      config,
      new Request("http://x/docs/?source"),
      "/docs/",
      `${f.root}/docs/README.md`,
      ["docs"],
      { directory: true, sourceName: "README.md" },
    );
    assertMatch(await source.text(), /data-git-change="unstaged"/);
    const rendered = await route(config, new Request("http://x/guide"));
    assertEquals((await rendered.text()).includes("data-git-change"), false);
    const alias = await route(config, new Request("http://x/guide?source"));
    assertMatch(await alias.text(), /data-git-change="unstaged"/);
    assertEquals(paths, ["code.txt", "docs/README.md", "guide.md"]);
  } finally {
    await f.cleanup();
  }
});
