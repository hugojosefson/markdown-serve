export function htmlResponse(request: Request, body: string): Response {
  return new Response(request.method === "HEAD" ? null : body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
