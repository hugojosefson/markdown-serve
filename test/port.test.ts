import { assertEquals, assertRejects } from "@std/assert";
import { startServer } from "../src/cli.ts";
import { serve } from "../src/server.ts";
import { fixture } from "./fixture.ts";

Deno.test("server binds exactly requested port", async () => {
  const f = await fixture({ "index.md": "root" });
  const server = await serve({ root: f.root, hostname: "127.0.0.1", port: 0 });
  const reserved = Deno.serve(
    { hostname: "127.0.0.1", port: 0 },
    () => new Response(),
  );
  try {
    assertEquals((server.addr as Deno.NetAddr).port > 0, true);
    await assertRejects(() =>
      serve({
        root: f.root,
        hostname: "127.0.0.1",
        port: (reserved.addr as Deno.NetAddr).port,
      })
    );
  } finally {
    await server.shutdown();
    await reserved.shutdown();
    await f.cleanup();
  }
});

Deno.test("CLI default ports fall forward but explicit occupied ports fail", async () => {
  const f = await fixture({ "index.md": "root" });
  const reserved = Deno.serve(
    { hostname: "127.0.0.1", port: 0 },
    () => new Response(),
  );
  const port = (reserved.addr as Deno.NetAddr).port;
  let fallback: Deno.HttpServer | undefined;
  try {
    fallback = await startServer({
      root: f.root,
      host: "127.0.0.1",
      port,
      explicitPort: false,
      redirectStatus: 302,
      reload: true,
      open: true,
    });
    assertEquals((fallback.addr as Deno.NetAddr).port > port, true);
    await assertRejects(() =>
      startServer({
        root: f.root,
        host: "127.0.0.1",
        port,
        explicitPort: true,
        redirectStatus: 302,
        reload: true,
        open: true,
      })
    );
  } finally {
    await fallback?.shutdown();
    await reserved.shutdown();
    await f.cleanup();
  }
});
