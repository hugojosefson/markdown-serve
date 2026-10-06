export function htmlResponse(
  request: Request,
  body: string,
  status = 200,
): Response {
  return new Response(request.method === "HEAD" ? null : body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
