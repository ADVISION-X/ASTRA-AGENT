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

export const readRequestBuffer = async (
  request: IncomingMessage,
  maxBytes = Number.POSITIVE_INFINITY,
): Promise<Buffer> => {
  const bufferedRequest = request as BufferedWorkbenchRequest;
  if (bufferedRequest.workbenchRawBody) {
    return bufferedRequest.workbenchRawBody;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > maxBytes) {
      throw new Error("WORKBENCH_REQUEST_BODY_TOO_LARGE");
    }
    chunks.push(bytes);
  }
  bufferedRequest.workbenchRawBody = Buffer.concat(chunks);
  return bufferedRequest.workbenchRawBody;
};
