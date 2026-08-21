import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { readRequestBuffer, writeJson } from "./workbench-http.js";

const OPEN = "/api/browser-extension-channel/open";
const INBOUND = "/api/browser-extension-channel/inbound";
const NEXT = "/api/browser-extension-channel/next";

export const handleWorkbenchBrowserExtensionChannelRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  workbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const operation = routeOperation(request.method, url.pathname);
  if (!operation) return false;
  const body = operation === "inbound" ? await readJson(request) : undefined;
  const grant = operation === "next" ? url.searchParams.get("grant") ?? undefined : readGrant(body);
  const frame = readFrame(body);
  const result = await workbench.workbenchBrowserExtensionChannel({ operation, ...(grant ? { grant } : {}), ...(frame === undefined ? {} : { frame }) });
  writeJson(response, 200, result);
  return true;
};

const routeOperation = (method: string | undefined, pathname: string): "open" | "inbound" | "next" | null => {
  if (method === "POST" && pathname === OPEN) return "open";
  if (method === "POST" && pathname === INBOUND) return "inbound";
  if (method === "GET" && pathname === NEXT) return "next";
  return null;
};

const readJson = async (request: IncomingMessage): Promise<unknown> => {
  const raw = (await readRequestBuffer(request, 262_144)).toString("utf8").trim();
  if (!raw) throw new Error("BROWSER_AUTH_TRANSCRIPT_INVALID");
  return JSON.parse(raw) as unknown;
};
const readGrant = (body: unknown): string | undefined => isRecord(body) && typeof body.grant === "string" ? body.grant : undefined;
const readFrame = (body: unknown): unknown => isRecord(body) ? body.frame : undefined;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
