import type { IncomingMessage, ServerResponse } from "node:http";

const CORS_HEADERS = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "access-control-allow-origin": "*",
} as const;

export const writeJson = (
  response: ServerResponse,
  statusCode: number,
  body: unknown,
): void => {
  response.writeHead(statusCode, { ...CORS_HEADERS, "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

export const writeCorsPreflight = (response: ServerResponse): void => {
  response.writeHead(204, CORS_HEADERS);
  response.end();
};

export const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};
