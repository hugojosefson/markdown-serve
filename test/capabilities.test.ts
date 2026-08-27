import { assertEquals } from "@std/assert";
import {
  assertServePermissions,
  formatRuntimeFeatureStatus,
  type PermissionQuery,
  runtimeCapabilities,
} from "../src/cli/capabilities.ts";

Deno.test("capabilities query exact browser and Git descriptors", () => {
  const descriptors: Deno.PermissionDescriptor[] = [];
  const query: PermissionQuery = (descriptor) => {
    descriptors.push(descriptor);
    return {
      state: descriptor.name === "run" && descriptor.command === "git"
        ? "denied"
        : "granted",
    };
  };
  assertEquals(runtimeCapabilities(query), {
    browser: true,
    git: false,
    finders: ["fd", "fdfind"],
  });
  assertEquals(descriptors, [
    { name: "env", variable: "MARKDOWN_SERVE_BROWSER_OPENED" },
    {
      name: "run",
      command: Deno.build.os === "darwin"
        ? "open"
        : Deno.build.os === "windows"
        ? "cmd"
        : "xdg-open",
    },
    { name: "run", command: "git" },
    { name: "run", command: "fd" },
    { name: "run", command: "fdfind" },
  ]);
});

Deno.test("serve permissions query normalized root and suppress browser warning for no-open", () => {
  const descriptors: Deno.PermissionDescriptor[] = [];
  const warnings: string[] = [];
  const query: PermissionQuery = (descriptor) => {
    descriptors.push(descriptor);
    return {
      state: descriptor.name === "read" || descriptor.name === "net"
        ? "granted"
        : "denied",
    };
  };
  assertServePermissions(
    ".",
    "localhost",
    8000,
    false,
    query,
    (message) => warnings.push(message),
  );
  assertEquals(descriptors[0], { name: "read", path: Deno.cwd() });
  assertEquals(warnings, [
    "Git integration unsupported; grant --allow-run=git",
  ]);
});

Deno.test("unsupported help includes exact grant hints", () => {
  assertEquals(
    formatRuntimeFeatureStatus({ browser: false, git: false, finders: [] }),
    `\n\nRuntime features:\n  Browser opening: unsupported; grant --allow-run=${
      Deno.build.os === "darwin"
        ? "open"
        : Deno.build.os === "windows"
        ? "cmd"
        : "xdg-open"
    } --allow-env=MARKDOWN_SERVE_BROWSER_OPENED\n  Git: unsupported; grant --allow-run=git\n  Fast file search: fallback scan`,
  );
});
