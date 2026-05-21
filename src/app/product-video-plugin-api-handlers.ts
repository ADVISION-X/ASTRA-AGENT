import type { IncomingMessage, ServerResponse } from "node:http";
import type { URL } from "node:url";

import { z } from "zod";

import type { GrassEyeWorkbenchHandle } from "../lib/local-runtime/workbench-handle.js";
import { ProductVideoDomMissionInputSchema } from "../plugins/product-video-dom-runtime/index.js";
import { parseJsonBody, writeJsonResponse } from "./workbench-api-helpers.js";

const PLUGIN_PREFIX = "/api/plugins/product-video-dom-runtime";
const ROUTE_START = "/api/plugins/product-video-dom-runtime/start";
const ROUTE_STATUS_PREFIX = "/api/plugins/product-video-dom-runtime/status/";
const DEFAULT_ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"] as const;

const getAllowedOrigins = (): Set<string> => {
  const configured = process.env.GRASSEYE_ALLOWED_ORIGINS
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return new Set(configured && configured.length > 0 ? configured : DEFAULT_ALLOWED_ORIGINS);
};

const applyCors = (request: IncomingMessage, response: ServerResponse): void => {
  const origin = request.headers.origin;
  if (typeof origin === "string" && getAllowedOrigins().has(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin, access-control-request-private-network");
  }
  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
  if (request.headers["access-control-request-private-network"] === "true") {
    response.setHeader("access-control-allow-private-network", "true");
  }
};

const prepareProductVideoPluginRequest = (
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
): boolean | null => {
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
};

const handleProductVideoStart = async (
  request: IncomingMessage,
  activeWorkbench: GrassEyeWorkbenchHandle,
): Promise<unknown> => {
  const mission = ProductVideoDomMissionInputSchema.parse(await parseJsonBody(request));
  return activeWorkbench.startProductVideoDomMiningTask({ mission });
};

const handleProductVideoStatus = async (
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const statusMatch = new RegExp(`^${ROUTE_STATUS_PREFIX.replaceAll("/", "\\/")}([^/]+)$`, "u").exec(url.pathname);
  if (!statusMatch?.[1]) {
    return false;
  }
  writeJsonResponse(response, 200, await activeWorkbench.getProductVideoDomTaskStatus(statusMatch[1]));
  return true;
};

const writeInvalidProductVideoRequest = (response: ServerResponse, error: unknown): boolean => {
  if (!(error instanceof z.ZodError || error instanceof SyntaxError || error instanceof Error)) {
    return false;
  }
  writeJsonResponse(response, 400, {
    ok: false,
    error: "invalid_product_video_dom_request",
    failureReason: error.message,
  });
  return true;
};

export const handleProductVideoPluginRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  activeWorkbench: GrassEyeWorkbenchHandle,
  url: URL,
): Promise<boolean> => {
  const prepared = prepareProductVideoPluginRequest(request, response, url);
  if (prepared !== null) {
    return prepared;
  }
  try {
    if (request.method === "GET" && await handleProductVideoStatus(response, activeWorkbench, url)) {
      return true;
    }
    if (request.method === "POST" && url.pathname === ROUTE_START) {
      writeJsonResponse(response, 200, await handleProductVideoStart(request, activeWorkbench));
      return true;
    }
    return false;
  } catch (error) {
    return writeInvalidProductVideoRequest(response, error);
  }
};
