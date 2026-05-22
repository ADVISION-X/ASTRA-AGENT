import type { IncomingMessage } from "node:http";

export type WorkbenchMultipartFile = {
  filename: string;
  mimeType: string;
  bytes: Buffer;
};

export type WorkbenchMultipartForm = {
  fields: ReadonlyMap<string, string>;
  files: ReadonlyMap<string, WorkbenchMultipartFile>;
};

type MultipartPart = {
  name: string;
  filename: string | null;
  mimeType: string;
  body: Buffer;
};

const HEADER_BODY_SEPARATOR = "\r\n\r\n";

export async function readMultipartFormData(request: IncomingMessage): Promise<WorkbenchMultipartForm> {
  const boundary = readMultipartBoundary(request.headers["content-type"]);
  const raw = await readRequestBuffer(request);
  const parts = parseMultipartParts(raw, boundary);
  const fields = new Map<string, string>();
  const files = new Map<string, WorkbenchMultipartFile>();

  for (const part of parts) {
    if (part.filename) {
      files.set(part.name, {
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        bytes: part.body,
      });
    } else {
      fields.set(part.name, part.body.toString("utf8"));
    }
  }

  return { fields, files };
}

function readMultipartBoundary(contentType: string | string[] | undefined): string {
  const header = Array.isArray(contentType) ? contentType[0] : contentType;
  const boundary = header?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("boundary="))
    ?.slice("boundary=".length)
    .replace(/^"|"$/g, "");
  if (!boundary) {
    throw new Error("multipart boundary is missing.");
  }
  return boundary;
}

async function readRequestBuffer(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parseMultipartParts(raw: Buffer, boundary: string): MultipartPart[] {
  const marker = `--${boundary}`;
  const encoded = raw.toString("latin1");
  return encoded
    .split(marker)
    .map((part) => part.trim())
    .filter((part) => part && part !== "--")
    .map(parseMultipartPart);
}

function parseMultipartPart(part: string): MultipartPart {
  const separatorIndex = part.indexOf(HEADER_BODY_SEPARATOR);
  if (separatorIndex < 0) {
    throw new Error("multipart part header is malformed.");
  }
  const rawHeaders = part.slice(0, separatorIndex);
  const rawBody = trimPartEnd(part.slice(separatorIndex + HEADER_BODY_SEPARATOR.length));
  const headers = parsePartHeaders(rawHeaders);
  const disposition = headers.get("content-disposition") ?? "";
  const name = readDispositionValue(disposition, "name");
  if (!name) {
    throw new Error("multipart field name is missing.");
  }
  return {
    name,
    filename: readDispositionValue(disposition, "filename"),
    mimeType: headers.get("content-type") ?? "",
    body: Buffer.from(rawBody, "latin1"),
  };
}

function parsePartHeaders(rawHeaders: string): ReadonlyMap<string, string> {
  const headers = new Map<string, string>();
  for (const line of rawHeaders.split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon <= 0) {
      continue;
    }
    headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return headers;
}

function readDispositionValue(disposition: string, key: string): string | null {
  const prefix = `${key}=`;
  const token = disposition
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return token ? token.slice(prefix.length).replace(/^"|"$/g, "") : null;
}

function trimPartEnd(value: string): string {
  return value.endsWith("\r\n") ? value.slice(0, -2) : value;
}
