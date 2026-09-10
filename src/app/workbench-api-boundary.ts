import type { IncomingHttpHeaders } from "node:http";

import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../lib/browser/release/unpacked-extension-release-identity.js";

export const GRASSEYE_BROWSER_EXTENSION_ORIGIN = `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}`;
export const GRASSEYE_TOOL_EXTENSION_ID_HEADER = "x-grasseye-tool-extension-id";

export type WorkbenchApiBoundaryDecision =
  | { kind: "not_api_request" }
  | { kind: "allowed"; corsHeaders: Record<string, string> }
  | {
      kind: "blocked";
      statusCode: 403 | 404 | 405;
      error: string;
      corsHeaders: Record<string, string>;
    };

const WORKBENCH_API_ROUTE_RULES = [
  { method: "GET", path: "/api/health", audience: "local-ui" },
  { method: "GET", path: "/api/browser-authority/pairing", audience: "local-extension" },
  { method: "GET", path: "/api/production-runtime/operations-snapshot", audience: "local-ui" },
] as const;

const readHeader = (headers: IncomingHttpHeaders, key: string): string | undefined => {
  const value = headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const hasExtensionHeader = (headers: IncomingHttpHeaders): boolean =>
  readHeader(headers, GRASSEYE_TOOL_EXTENSION_ID_HEADER) === GRASSEYE_UNPACKED_EXTENSION_ID;

const extensionHeaderRequested = (headers: IncomingHttpHeaders): boolean =>
  (readHeader(headers, "access-control-request-headers") ?? "")
    .split(",")
    .some((header) => header.trim().toLowerCase() === GRASSEYE_TOOL_EXTENSION_ID_HEADER);

const getLocalOrigins = (baseUrl: string): Set<string> => {
  const url = new URL(baseUrl);
  const port = url.port ? `:${url.port}` : "";
  return new Set([url.origin, `http://127.0.0.1${port}`, `http://localhost${port}`]);
};

const readAudience = (
  origin: string | undefined,
  baseUrl: string,
  headers: IncomingHttpHeaders,
): "local-ui" | "local-extension" | "denied" => {
  if (!origin) return hasExtensionHeader(headers) ? "local-extension" : "local-ui";
  if (origin === GRASSEYE_BROWSER_EXTENSION_ORIGIN) {
    return hasExtensionHeader(headers) || extensionHeaderRequested(headers) ? "local-extension" : "denied";
  }
  return getLocalOrigins(baseUrl).has(origin) ? "local-ui" : "denied";
};

const buildCorsHeaders = (
  origin: string,
  audience: "local-ui" | "local-extension" | "denied",
): Record<string, string> => ({
  ...(audience === "local-extension"
    ? { "access-control-allow-origin": GRASSEYE_BROWSER_EXTENSION_ORIGIN }
    : audience === "local-ui"
      ? { "access-control-allow-origin": origin }
      : {}),
  "access-control-allow-headers": "x-grasseye-tool-extension-id",
  "access-control-allow-methods": "GET,OPTIONS",
  "vary": "Origin",
});

const block = (
  statusCode: 403 | 404 | 405,
  error: string,
  corsHeaders: Record<string, string>,
): WorkbenchApiBoundaryDecision => ({ kind: "blocked", statusCode, error, corsHeaders });

export function handleWorkbenchApiBoundary(input: {
  method: string | undefined;
  path: string;
  origin: string | undefined;
  headers: IncomingHttpHeaders;
  baseUrl: string;
}): WorkbenchApiBoundaryDecision {
  if (!input.path.startsWith("/api/")) return { kind: "not_api_request" };

  const audience = readAudience(input.origin, input.baseUrl, input.headers);
  const corsHeaders = buildCorsHeaders(input.origin ?? input.baseUrl, audience);
  if (input.method !== "GET" && input.method !== "POST" && input.method !== "DELETE") {
    return block(405, "method_not_allowed", corsHeaders);
  }

  const routeRule = WORKBENCH_API_ROUTE_RULES.find((rule) =>
    rule.method === input.method && rule.path === input.path,
  );
  if (!routeRule) return block(404, "api_route_not_allowed", corsHeaders);
  if (audience === "denied") return block(403, "origin_not_allowed", corsHeaders);
  if (routeRule.audience !== audience) {
    return block(403, audience === "local-extension" ? "route_not_extension_allowed" : "route_not_local_allowed", corsHeaders);
  }
  return { kind: "allowed", corsHeaders };
}
