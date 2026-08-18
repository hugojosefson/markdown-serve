import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { openBrowser, openerCommand, usableUrl } from "../src/cli/browser.ts";
import { parseArgs } from "../src/cli/parse-args.ts";
import { parseCommand } from "../src/cli/parse-command.ts";
import { usage } from "../src/cli/usage.ts";

Deno.test("parser uses documented defaults", () => {
  assertEquals(parseArgs([]), {
    root: ".",
    host: "localhost",
    port: 8000,
    explicitPort: false,
    redirectStatus: 302,
    reload: true,
    open: true,
  });
});

Deno.test("parser accepts separated and equals option values", () => {
  assertEquals(
    parseArgs([
      "docs",
      "--host=127.0.0.1",
      "--port=9000",
      "--redirect=301",
      "--no-open",
      "--no-reload",
    ]),
    {
      root: "docs",
      host: "127.0.0.1",
      port: 9000,
      explicitPort: true,
      redirectStatus: 301,
      reload: false,
      open: false,
    },
  );
  assertEquals(
    parseArgs(["--host", "::1", "--port", "8001", "--redirect", "302"]).port,
    8001,
  );
});

Deno.test("parser rejects invalid option values", () => {
  assertThrows(() => parseArgs(["--redirect=303"]));
  assertThrows(() => parseArgs(["--port=0"]));
  assertThrows(() => parseArgs(["--host="]));
  assertThrows(() => parseArgs(["--unknown"]));
});

Deno.test("help and version commands are identified without server startup", () => {
  assertEquals(parseCommand(["--help"]), { kind: "help" });
  assertEquals(parseCommand(["-V"]), { kind: "version" });
  assertEquals(parseCommand(["docs"]).kind, "serve");
  assertMatch(usage, /--redirect=<301\|302>/);
});

Deno.test("browser opener command and usable URL are platform-safe", () => {
  assertEquals(openerCommand("http://x/", "linux"), ["xdg-open", [
    "http://x/",
  ]]);
  assertEquals(openerCommand("http://x/", "darwin"), ["open", ["http://x/"]]);
  assertEquals(openerCommand("http://x/", "windows"), ["cmd", [
    "/c",
    "start",
    "",
    "http://x/",
  ]]);
  assertEquals(
    usableUrl({ transport: "tcp", hostname: "0.0.0.0", port: 8000 }),
    "http://localhost:8000/",
  );
  assertEquals(
    usableUrl({ transport: "tcp", hostname: "::1", port: 8000 }),
    "http://[::1]:8000/",
  );
});

Deno.test("browser opener failure is nonfatal", async () => {
  const warnings: string[] = [];
  await openBrowser(
    "http://x/",
    () => Promise.resolve({ success: false }),
    (message) => warnings.push(message),
  );
  assertEquals(warnings, ["Could not open browser: xdg-open failed"]);
});
