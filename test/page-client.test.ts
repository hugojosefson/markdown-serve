import { assertEquals } from "@std/assert";
import { pageClient } from "../src/server/page-client.ts";

Deno.test("folder index discovery uses a bounded queue and adds controls", async () => {
  type Link = {
    ariaLabel?: string;
    className?: string;
    href?: string;
    title?: string;
  };
  const requests: Array<{
    resolve: (response: { ok: boolean; json(): Promise<unknown> }) => void;
    url: string;
  }> = [];
  const details = Array.from({ length: 5 }, (_, index) => {
    let filesLink: Link | undefined;
    const summary = { append: (link: Link) => filesLink = link };
    return {
      dataset: { indexPending: "true", path: `folder-${index}` },
      querySelector: (selector: string) => {
        if (selector === ".tree-files-link") {
          return filesLink;
        }
        if (selector === ".tree-folder-link") {
          return { textContent: `folder-${index}/` };
        }
        return selector === "summary" ? summary : undefined;
      },
      filesLink: () => filesLink,
    };
  });
  const tree = {
    addEventListener: () => {},
    querySelectorAll: () => details,
  };
  const fetch = (url: string) =>
    new Promise<{ ok: boolean; json(): Promise<unknown> }>((resolve) => {
      requests.push({ resolve, url });
    });

  new Function(
    "document",
    "fetch",
    "HTMLDetailsElement",
    "location",
    "syncNavigationLinks",
    pageClient,
  )(
    {
      createElement: () => ({}),
      querySelector: () => tree,
    },
    fetch,
    class {},
    { href: "http://x/" },
    () => {},
  );

  assertEquals(requests.length, 4);
  requests[0].resolve({
    ok: true,
    json: () => Promise.resolve({ filesHref: "/folder-0/?dir" }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertEquals(requests.length, 5);
  assertEquals(details[0].filesLink()?.href, "/folder-0/?dir");

  for (const request of requests.slice(1)) {
    request.resolve({ ok: true, json: () => Promise.resolve({}) });
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertEquals(
    requests.map(({ url }) => url),
    [0, 1, 2, 3, 4].map((index) =>
      `/__markdown_server__/index?path=folder-${index}`
    ),
  );
});
