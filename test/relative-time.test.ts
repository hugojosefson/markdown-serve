import { assert, assertEquals, assertMatch } from "@std/assert";
import {
  formatRelativeTime,
  relativeTimeUpdateDelay,
} from "../src/server/relative-time.ts";

const now = new Date("2020-01-01T00:00:00.000Z");

Deno.test("relative timestamps use English text for past and future dates", () => {
  assertEquals(
    formatRelativeTime(new Date(+now - 2_000), now),
    "2 seconds ago",
  );
  assertEquals(formatRelativeTime(new Date(+now + 2_000), now), "in 2 seconds");
  assertEquals(
    formatRelativeTime(new Date(+now - 86_400_000), now),
    "yesterday",
  );
});

Deno.test("relative timestamps schedule their next rounded-text change", () => {
  assertEquals(relativeTimeUpdateDelay(new Date(+now - 10_200), now), 310);
  assertEquals(relativeTimeUpdateDelay(new Date(+now + 10_200), now), 710);
  assertEquals(relativeTimeUpdateDelay(new Date(+now + 200), now), 710);
  assertEquals(
    relativeTimeUpdateDelay(new Date(+now - 7_200_000), now),
    1_800_010,
  );
  assertEquals(relativeTimeUpdateDelay(new Date(+now + 61_000), now), 1_010);
});

Deno.test("relative timestamps remain meaningful at the Date range limits", () => {
  for (
    const date of [
      new Date(-8_640_000_000_000_000),
      new Date(8_640_000_000_000_000),
    ]
  ) {
    assertMatch(formatRelativeTime(date, now), /years?(?: ago)?|in \d/);
    const delay = relativeTimeUpdateDelay(date, now);
    assert(Number.isFinite(delay));
    assert(delay >= 10);
  }
});
