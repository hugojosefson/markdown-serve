import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  formatSize,
  renderFileMetadataDetails,
} from "../src/server/file-metadata.ts";
import { renderIsoTimestamp } from "../src/server/render-iso-timestamp.ts";

Deno.test("compact file sizes include byte units and spacing", () => {
  assertEquals(
    [0, 1, 1023, 1024, 1536, 10 * 1024, 1024 ** 2].map(formatSize),
    ["0 B", "1 B", "1023 B", "1 KB", "1.5 KB", "10 KB", "1 MB"],
  );
});

Deno.test("expanded metadata omits redundant byte notation", () => {
  const details = (size: number) =>
    renderFileMetadataDetails(
      { mime: "text/plain", size },
      new URL("http://x/"),
    );
  assert(details(1).includes("<dd>1 byte</dd>"));
  assert(details(218).includes("<dd>218 bytes</dd>"));
  assert(details(1024).includes("<dd>1024 bytes (1 KB)</dd>"));
});

Deno.test("ISO timestamps expose copyable text and styled separators", () => {
  const value = "2020-01-02T03:04:05.678Z";
  const html = renderIsoTimestamp(new Date(value));
  assertMatch(
    html,
    new RegExp(`<time datetime="${value}" aria-label="${value}">`),
  );
  assertEquals(html.replace(/<[^>]+>/g, ""), value);
  assertMatch(html, /class="timestamp-separator timestamp-t">T<\/span>/);
  assertMatch(html, /class="timestamp-separator timestamp-zone">Z<\/span>/);
});
