import path from "node:path";
import type { IncomingMessage } from "node:http";
import type { URL } from "node:url";

export function getArtifactContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    default:
      return "image/svg+xml; charset=utf-8";
  }
}

export async function parseJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function parseTailParam(url: URL): number {
  const requestedTail = Number(url.searchParams.get("tail") ?? "200");
  if (!Number.isFinite(requestedTail) || requestedTail <= 0) {
    return 200;
  }

  return Math.min(Math.trunc(requestedTail), 1000);
}