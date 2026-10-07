import { NextRequest } from "next/server";

export interface ApiCallOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  headers?: Record<string, string>;
  body?: any;
  userId?: string;
}

export async function callApi(
  path: string,
  handler: (req: NextRequest) => Promise<Response>,
  options: ApiCallOptions = {}
): Promise<Response> {
  const { method = "GET", headers = {}, body, userId } = options;

  const requestHeaders = new Headers();
  requestHeaders.set("content-type", "application/json");

  if (userId) {
    requestHeaders.set("x-user-id", userId);
  }

  Object.entries(headers).forEach(([key, value]) => {
    requestHeaders.set(key, value);
  });

  const req = new NextRequest(`http://localhost:3000${path}`, {
    method,
    headers: requestHeaders,
    ...(body && { body: JSON.stringify(body) }),
  });

  return handler(req);
}
