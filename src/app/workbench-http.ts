import type { ServerResponse } from "node:http";

export const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(statusCode, { ...headers, "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

export const writeCorsPreflight = (
  response: ServerResponse,
  headers: Record<string, string>,
): void => {
  response.writeHead(204, headers);
  response.end();
};
