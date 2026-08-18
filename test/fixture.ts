import { createHandler, type HandlerOptions } from "../src/server.ts";

export async function fixture(files: Record<string, string>) {
  const root = await Deno.makeTempDir();
  for (const [name, content] of Object.entries(files)) {
    const path = `${root}/${name}`;
    await Deno.mkdir(path.substring(0, path.lastIndexOf("/")), {
      recursive: true,
    });
    await Deno.writeTextFile(path, content);
  }
  return { root, cleanup: () => Deno.remove(root, { recursive: true }) };
}

export async function handler(
  root: string,
  overrides: Partial<HandlerOptions> = {},
) {
  return await createHandler({
    root,
    redirectStatus: 302,
    ...overrides,
  });
}
