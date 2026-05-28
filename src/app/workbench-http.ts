import type { IncomingMessage, ServerResponse } from "node:http";

type BufferedWorkbenchRequest = IncomingMessage & {
  workbenchRawBody?: Buffer;
};

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

export const readRequestBuffer = async (request: IncomingMessage): Promise<Buffer> => {
  const bufferedRequest = request as BufferedWorkbenchRequest;
  if (bufferedRequest.workbenchRawBody) {
    return bufferedRequest.workbenchRawBody;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  bufferedRequest.workbenchRawBody = Buffer.concat(chunks);
  return bufferedRequest.workbenchRawBody;
};

export const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const raw = (await readRequestBuffer(request)).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
};
