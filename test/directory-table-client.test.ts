import { assertEquals } from "@std/assert";
import { directoryTableClient } from "../src/server/directory-table-client.ts";

Deno.test("directory columns hide until filenames fit without wrapping", () => {
  const widths: Record<string, number> = {
    "": 700,
    "user": 560,
    "user permissions": 430,
    "user permissions modified": 240,
    "user permissions modified size": 180,
  };
  const table = {
    dataset: { hiddenColumns: "" },
    get scrollWidth() {
      return widths[this.dataset.hiddenColumns];
    },
  };
  const container = {
    clientWidth: 300,
    querySelector: () => table,
  };
  const navigation = {};
  let navigationDisplay = "block";
  let resized = () => {};
  class Observer {
    constructor(
      callback: (entries: Array<{ target: typeof container }>) => void,
    ) {
      resized = () => callback([{ target: container }]);
    }
    observe() {}
  }
  new Function(
    "document",
    "ResizeObserver",
    "getComputedStyle",
    "addEventListener",
    directoryTableClient,
  )(
    {
      querySelector: (selector: string) =>
        selector === ".tree" ? navigation : null,
      querySelectorAll: () => [container],
    },
    Observer,
    () => ({ display: navigationDisplay }),
    () => {},
  );
  assertEquals(table.dataset.hiddenColumns, "user permissions modified");

  container.clientWidth = 500;
  resized();
  assertEquals(table.dataset.hiddenColumns, "user permissions");

  container.clientWidth = 800;
  resized();
  assertEquals(table.dataset.hiddenColumns, "");

  navigationDisplay = "none";
  resized();
  assertEquals(table.dataset.hiddenColumns, "user permissions modified");

  container.clientWidth = 170;
  resized();
  assertEquals(
    table.dataset.hiddenColumns,
    "user permissions modified size",
  );
});
