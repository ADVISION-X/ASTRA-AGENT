import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { z } from "zod";

import {
  AmazonInvoiceUploadAdminOpenInputSchema,
  AmazonInvoiceUploadMissionInputSchema,
} from "../plugins/amazon-invoice-upload/index.js";
import type { AmazonInvoiceUploadPdfFile } from "../plugins/amazon-invoice-upload/index.js";
import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

const PLUGIN_PREFIX = "/api/plugins/amazon-invoice-upload";
const ROUTE_OPEN_ADMIN = "/api/plugins/amazon-invoice-upload/open-admin";
const ROUTE_START = "/api/plugins/amazon-invoice-upload/start";
const ROUTE_RESUME = "/api/plugins/amazon-invoice-upload/resume";
const ROUTE_STATUS_PREFIX = "/api/plugins/amazon-invoice-upload/status/";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

type MultipartMissionPayload = {
  mission: unknown;
  invoicePdf: AmazonInvoiceUploadPdfFile;
};

function getAllowedOrigins(): Set<string> {
  const configured = process.env.GRASSEYE_ALLOWED_ORIGINS
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function applyCors(request: IncomingMessage, response: ServerResponse): void {
  const origin = request.headers.origin;
  if (typeof origin === "string" && getAllowedOrigins().has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin");
  }
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
}

async function readRequestBuffer(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function parsePartHeaders(rawHeaders: string): Record<string, string> {
  const entries = rawHeaders.split("\r\n").map((line) => {
    const separator = line.indexOf(":");
    return separator > 0 ? [line.slice(0, separator).toLowerCase(), line.slice(separator + 1).trim()] : null;
  }).filter((entry): entry is [string, string] => entry !== null);
  return Object.fromEntries(entries);
}

function parseContentDisposition(value: string): { name: string; filename?: string } {
  const name = /(?:^|;)\s*name="([^"]+)"/u.exec(value)?.[1] ?? "";
  const filename = /(?:^|;)\s*filename="([^"]*)"/u.exec(value)?.[1];
  return { name, ...(filename ? { filename } : {}) };
}

function parseMultipartBody(buffer: Buffer, boundary: string): MultipartMissionPayload {
  const raw = buffer.toString("latin1");
  const parts = raw
    .split(`--${boundary}`)
    .map((part) => part.replace(/^\r\n/u, "").replace(/\r\n$/u, ""))
    .filter((part) => part.includes("\r\n\r\n") && part.trim() !== "--");
  let mission: unknown = null;
  let invoicePdf: AmazonInvoiceUploadPdfFile | null = null;
  for (const part of parts) {
    const [rawHeaders, ...bodyParts] = part.split("\r\n\r\n");
    const headers = parsePartHeaders(rawHeaders ?? "");
    const disposition = parseContentDisposition(headers["content-disposition"] ?? "");
    const body = bodyParts.join("\r\n\r\n").replace(/\r\n$/u, "");
    if (disposition.name === "mission") {
      const missionJson = Buffer.from(body, "latin1").toString("utf8").trim();
      if (missionJson) {
        mission = JSON.parse(missionJson);
      }
    }
    if (disposition.name === "invoicePdf" && disposition.filename) {
      invoicePdf = {
        filename: disposition.filename,
        mimeType: headers["content-type"] ?? "application/octet-stream",
        bytes: Buffer.from(body, "latin1"),
      };
    }
  }
  if (!invoicePdf || mission === null) {
    throw new Error("multipart request must include mission and invoicePdf.");
  }
  return { mission, invoicePdf };
}

async function parseMultipartMission(request: IncomingMessage): Promise<MultipartMissionPayload> {
  const contentType = request.headers["content-type"] ?? "";
  const boundary = /boundary=([^;]+)/u.exec(String(contentType))?.[1];
  if (!boundary || !String(contentType).toLowerCase().startsWith("multipart/form-data")) {
    throw new Error("amazon invoice upload start requires multipart/form-data.");
  }
  return parseMultipartBody(await readRequestBuffer(request), boundary);
}

async function handleStart(
  request: IncomingMessage,
  activeWorkbench: GrassEyeWorkbenchHandle,
): Promise<unknown> {
  const payload = await parseMultipartMission(request);
  const mission = AmazonInvoiceUploadMissionInputSchema.parse(payload.mission);
  return activeWorkbench.startAmazonInvoiceUploadTask({
    mission,
    invoicePdf: payload.invoicePdf,
  });
}

async function handleResume(
  request: IncomingMessage,
  activeWorkbench: GrassEyeWorkbenchHandle,
): Promise<unknown> {
  const body = await parseJsonBody(request);
  const input = z.object({ taskId: z.string().min(1) }).strict().parse(body);
  return activeWorkbench.resumeAmazonInvoiceUploadTask(input);
}

async function handleJsonPluginPost(
  request: IncomingMessage,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<unknown> {
  if (url.pathname === ROUTE_OPEN_ADMIN) {
    const input = AmazonInvoiceUploadAdminOpenInputSchema.parse(await parseJsonBody(request));
    return activeWorkbench.openAdminInvoicePage(input);
  }
  if (url.pathname === ROUTE_RESUME) {
    return handleResume(request, activeWorkbench);
  }
  return null;
}

async function handlePluginStatusRequest(
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  const statusMatch = new RegExp(`^${ROUTE_STATUS_PREFIX.replaceAll("/", "\\/")}([^/]+)$`, "u").exec(url.pathname);
  if (!statusMatch?.[1]) {
    return false;
  }
  writeJsonResponse(response, 200, await activeWorkbench.getAmazonInvoiceUploadTaskStatus(statusMatch[1]));
  return true;
}

async function handlePluginPostRequest(input: {
  request: IncomingMessage;
  response: ServerResponse;
  activeWorkbench: GrassEyeWorkbenchHandle;
  url: URL;
}): Promise<boolean> {
  if (input.url.pathname === ROUTE_START) {
    writeJsonResponse(input.response, 200, await handleStart(input.request, input.activeWorkbench));
    return true;
  }
  if (input.request.method !== "POST") {
    return false;
  }
  const payload = await handleJsonPluginPost(input.request, input.activeWorkbench, input.url);
  if (!payload) {
    return false;
  }
  writeJsonResponse(input.response, 200, payload);
  return true;
}

function writeInvalidPluginRequest(response: ServerResponse, error: Error): void {
  writeJsonResponse(response, 400, {
    ok: false,
    error: "invalid_plugin_request",
    failureReason: error.message,
  });
}

function preparePluginTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): boolean | null {
  if (!url.pathname.startsWith(PLUGIN_PREFIX)) {
    return false;
  }
  applyCors(request, response);
  if (request.method !== "OPTIONS") {
    return null;
  }
  response.writeHead(204);
  response.end();
  return true;
}

async function tryHandlePluginTaskRoute(input: {
  request: IncomingMessage;
  response: ServerResponse;
  activeWorkbench: GrassEyeWorkbenchHandle;
  url: URL;
}): Promise<boolean> {
  if (input.request.method === "GET" && await handlePluginStatusRequest(input.response, input.activeWorkbench, input.url)) {
    return true;
  }
  return handlePluginPostRequest(input);
}

function handlePluginTaskError(response: ServerResponse, error: unknown): boolean {
  if (!(error instanceof z.ZodError || error instanceof SyntaxError || error instanceof Error)) {
    return false;
  }
  writeInvalidPluginRequest(response, error);
  return true;
}

export async function handlePluginTaskRequest(
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> {
  const prepared = preparePluginTaskRequest(request, response, url);
  if (prepared !== null) {
    return prepared;
  }
  try {
    return await tryHandlePluginTaskRoute({ request, response, activeWorkbench, url });
  } catch (error) {
    return handlePluginTaskError(response, error);
  }
}
