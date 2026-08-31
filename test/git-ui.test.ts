import { assertEquals, assertMatch } from "@std/assert";
import { FileCatalog } from "../src/server/file-catalog.ts";
import { parseGitStatus } from "../src/server/git/status.ts";
import { page } from "../src/server/page.ts";
import { pageCss } from "../src/server/page-css.ts";
import { treeResponse } from "../src/server/tree-response.ts";
import type { ServerConfig } from "../src/server/types.ts";
import { fixture } from "./fixture.ts";

Deno.test("Git context and statuses match SSR and lazy navigation", async () => {
  const f = await fixture({
    "README.md": "root",
    "docs/changed.md": "changed",
    "docs/ignored.txt": "ignored",
    "ignored/.keep": "ignored directory",
  });
  try {
    const catalog = new FileCatalog();
    await catalog.warmRoot(f.root);
    const status = parseGitStatus(
      "## main...origin/main [ahead 2]\0 M docs/changed.md\0!! docs/ignored.txt\0!! ignored/\0",
    );
    const config: ServerConfig = {
      rootPath: f.root,
      rootLabel: `${f.root}/`,
      redirectStatus: 302,
      catalog,
      git: {
        root: f.root,
        repositoryRoot: f.root,
        subdirectory: "",
        worktree: true,
        status: () => Promise.resolve(status),
        diff: () => Promise.resolve(undefined),
        head: () => Promise.resolve(undefined),
        refresh: () => Promise.resolve(),
      },
    };
    const html = await page(config, {
      title: "root",
      parts: [],
      directory: false,
      content: "<p>root</p>",
      url: new URL("http://x/"),
      gitStatus: status,
    });
    assertMatch(html, /class="tree-repo-context"[^>]*>main <b>1<\/b>/);
    assertMatch(
      html,
      /class="repo-context"[^>]*>main<span[^>]*> · <\/span>1 dirty/,
    );
    assertMatch(
      html,
      /data-kind="directory" data-git-ignored="true" href="\/ignored\/"/,
    );
    assertMatch(html, /data-git-kind="ignored"[^>]*>!!<\/span>/);
    const docsHtml = await page(config, {
      title: "docs",
      parts: ["docs"],
      directory: true,
      directoryView: true,
      content: "<p>docs</p>",
      url: new URL("http://x/docs/"),
      gitStatus: status,
    });
    assertMatch(
      docsHtml,
      /<li class="tree-entry-row"><a data-kind="file" href="\/docs\/changed">changed\.md<\/a><span class="git-marker"[^>]*>M<\/span><\/li>/,
    );
    assertMatch(
      pageCss,
      /\.tree \.git-marker \{ flex: 0 0 auto; margin-right: 6px; white-space: nowrap; \}/,
    );

    const response = await treeResponse(
      config,
      new Request("http://x/__markdown_serve__/tree?path=docs"),
      "docs",
    );
    const children = await response.json() as Array<{
      name: string;
      git?: { display: string; kind: string; tooltip: string };
    }>;
    assertEquals(children.find((entry) => entry.name === "changed.md")?.git, {
      display: "M",
      kind: "modified",
      tooltip: "Modified",
    });
    assertEquals(children.find((entry) => entry.name === "ignored.txt")?.git, {
      display: "!!",
      kind: "ignored",
      tooltip: "Ignored",
    });
  } finally {
    await f.cleanup();
  }
});
