import { resolve } from "@std/path";
import { openerCommand } from "./browser.ts";

export type RuntimeCapabilities = { browser: boolean; git: boolean };
export type PermissionQuery = (
  descriptor: Deno.PermissionDescriptor,
) => Pick<Deno.PermissionStatus, "state">;
export type Warn = (message: string) => void;

export function runtimeCapabilities(
  query: PermissionQuery = Deno.permissions.querySync,
): RuntimeCapabilities {
  const [opener] = openerCommand("http://localhost/");
  return {
    browser: granted(query, browserEnvDescriptor) &&
      granted(query, { name: "run", command: opener }),
    git: granted(query, gitDescriptor),
  };
}

export function assertServePermissions(
  root: string,
  host: string,
  port: number,
  open: boolean,
  query: PermissionQuery = Deno.permissions.querySync,
  warn: Warn = console.warn,
): RuntimeCapabilities {
  const rootPath = resolve(root);
  if (!granted(query, { name: "read", path: rootPath })) {
    throw new Error(`Cannot read ${rootPath}; grant --allow-read=${rootPath}`);
  }
  if (!granted(query, { name: "net", host: `${host}:${port}` })) {
    throw new Error(
      `Cannot listen on ${host}:${port}; grant --allow-net=${host}:${port}`,
    );
  }
  const capabilities = runtimeCapabilities(query);
  if (open && !capabilities.browser) {
    warn(`Browser opening unsupported; grant ${browserGrantHint()}`);
  }
  if (!capabilities.git) {
    warn(`Git integration unsupported; grant ${gitGrantHint}`);
  }
  return capabilities;
}

export function runtimeFeatureStatus(): string {
  return formatRuntimeFeatureStatus(runtimeCapabilities());
}

export function formatRuntimeFeatureStatus(
  capabilities: RuntimeCapabilities,
): string {
  return `\n\nRuntime features:\n  Browser opening: ${
    capabilities.browser
      ? "supported"
      : `unsupported; grant ${browserGrantHint()}`
  }\n  Git: ${
    capabilities.git ? "supported" : `unsupported; grant ${gitGrantHint}`
  }`;
}

export const browserEnvDescriptor = {
  name: "env",
  variable: "MARKDOWN_SERVER_BROWSER_OPENED",
} as const;
export const gitDescriptor = { name: "run", command: "git" } as const;
export const gitGrantHint = "--allow-run=git";

export function browserGrantHint(): string {
  const [opener] = openerCommand("http://localhost/");
  return `--allow-run=${opener} --allow-env=MARKDOWN_SERVER_BROWSER_OPENED`;
}

function granted(
  query: PermissionQuery,
  descriptor: Deno.PermissionDescriptor,
): boolean {
  return query(descriptor).state === "granted";
}
