import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { GRASSEYE_UNPACKED_EXTENSION_ID } from "../lib/browser/release/unpacked-extension-release-identity.js";

export const GRASSEYE_BROWSER_EXTENSION_ORIGIN = `chrome-extension://${GRASSEYE_UNPACKED_EXTENSION_ID}`;
export const GRASSEYE_TOOL_EXTENSION_ID_HEADER = "x-grasseye-tool-extension-id";

export type WorkbenchApiRouteRule = {
  method: "GET" | "POST" | "DELETE";
  pathPattern: "exact" | "prefix";
  path: string;
  localUiAllowed: boolean;
  localExtensionAllowed?: boolean;
  externalApiAllowed: boolean;
  requiresSiteHmac: boolean;
  jobOwner?: string;
  purpose: string;
};

export type WorkbenchApiBoundaryDecision =
  | { kind: "not_api_request" }
  | {
      kind: "allowed";
      corsHeaders: Record<string, string>;
      routeRule: WorkbenchApiRouteRule;
      originCategory: "local-ui" | "local-extension" | "external-website";
    }
  | {
      kind: "blocked";
      statusCode: 403 | 404 | 405;
      error: string;
      reason: string;
      corsHeaders: Record<string, string>;
    };

export const EXTERNAL_REQUEST_FORBIDDEN_KEYS = [
  "selector",
  "selectors",
  "coordinate",
  "coordinates",
  "x",
  "y",
  "browserCommand",
  "nextAction",
  "actionPlan",
  "flowStep",
  "documentId",
  "downloadUrl",
  "abilityGroupId",
  "childCapabilityId",
  "capabilityCallId",
  "evidenceRefOverride",
  "cookie",
  "sellerCentralCookie",
  "browserProfileDirectory",
] as const;

export const WORKBENCH_API_ROUTE_RULES: WorkbenchApiRouteRule[] = [
  { method: "GET", pathPattern: "exact", path: "/api/health", localUiAllowed: true, externalApiAllowed: false, requiresSiteHmac: false, purpose: "workbench_health" },
  { method: "GET", pathPattern: "exact", path: "/api/mode", localUiAllowed: true, externalApiAllowed: false, requiresSiteHmac: false, purpose: "workbench_mode" },
  { method: "GET", pathPattern: "exact", path: "/api/browser-authority/pairing", localUiAllowed: false, localExtensionAllowed: true, externalApiAllowed: false, requiresSiteHmac: false, purpose: "local_browser_authority_pairing" },
  { method: "GET", pathPattern: "exact", path: "/api/production-runtime/status", localUiAllowed: true, externalApiAllowed: false, requiresSiteHmac: false, jobOwner: "production-runtime", purpose: "local_production_task_status" },
  { method: "GET", pathPattern: "exact", path: "/api/production-runtime/diagnosis", localUiAllowed: true, externalApiAllowed: false, requiresSiteHmac: false, jobOwner: "production-runtime", purpose: "local_production_runtime_diagnosis" },
];

type BodyPreview = {
  fields?: Record<string, unknown>;
  files?: readonly string[];
  json?: unknown;
};

const forbiddenKeySet = new Set<string>(EXTERNAL_REQUEST_FORBIDDEN_KEYS);

const readHeader = (headers: IncomingHttpHeaders, key: string): string | undefined => {
  const value = headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
};

const splitCsv = (value: string | undefined): string[] =>
  (value ?? "").split(",").map((part) => part.trim()).filter((part) => part.length > 0);

const matchRouteRule = (method: string | undefined, path: string): WorkbenchApiRouteRule | null => {
  if (method !== "GET" && method !== "POST" && method !== "DELETE") {
    return null;
  }
  return WORKBENCH_API_ROUTE_RULES.find((rule) =>
    rule.method === method && (rule.pathPattern === "exact" ? rule.path === path : path.startsWith(rule.path)),
  ) ?? null;
};

const buildCorsHeaders = (origin: string | undefined, methods = "GET,POST,DELETE,OPTIONS"): Record<string, string> => ({
  ...(origin ? { "access-control-allow-origin": origin } : {}),
  "access-control-allow-headers": "content-type,x-grasseye-tool-extension-id,x-grasseye-signature,x-grasseye-source-system,x-grasseye-request-id",
  "access-control-allow-methods": methods,
  "vary": "Origin",
});

const getLocalOrigins = (baseUrl: string): Set<string> => {
  const url = new URL(baseUrl);
  const port = url.port ? `:${url.port}` : "";
  return new Set([url.origin, `http://127.0.0.1${port}`, `http://localhost${port}`]);
};

const readOriginCategory = (
  origin: string | undefined,
  baseUrl: string,
  headers: IncomingHttpHeaders,
): "local-ui" | "local-extension" | "external-website" | "blocked" => {
  const extensionIdentity = readHeader(headers, GRASSEYE_TOOL_EXTENSION_ID_HEADER);
  const extensionIdentityMatches = extensionIdentity === GRASSEYE_UNPACKED_EXTENSION_ID;
  const extensionPreflight = splitCsv(readHeader(headers, "access-control-request-headers"))
    .some((header) => header.toLowerCase() === GRASSEYE_TOOL_EXTENSION_ID_HEADER);
  if (!origin) {
    return extensionIdentityMatches ? "local-extension" : "local-ui";
  }
  if (origin === GRASSEYE_BROWSER_EXTENSION_ORIGIN) {
    return extensionIdentityMatches || extensionPreflight ? "local-extension" : "blocked";
  }
  if (origin === "null" || origin.startsWith("file://") || origin.startsWith("chrome-extension://")) {
    return "blocked";
  }
  return getLocalOrigins(baseUrl).has(origin) ? "local-ui" : "external-website";
};

const hasForbiddenKey = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = hasForbiddenKey(item);
      if (found) return found;
    }
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeySet.has(key)) {
      return key;
    }
    const found = hasForbiddenKey(child);
    if (found) return found;
  }
  return null;
};

const parseJsonText = (value: unknown): unknown =>
  typeof value === "string" && value.trim().startsWith("{") ? safeParseJson(value) : value;

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const callbackUrlFromObject = (value: unknown): string | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const callbackUrl = (value as { callbackUrl?: unknown }).callbackUrl;
  if (typeof callbackUrl === "string" && callbackUrl.trim().length > 0) {
    return callbackUrl.trim();
  }
  const mission = parseJsonText((value as { mission?: unknown }).mission);
  if (mission && typeof mission === "object" && !Array.isArray(mission)) {
    const value = (mission as { callbackUrl?: unknown }).callbackUrl;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  }
  return null;
};

const readCallbackUrl = (preview: BodyPreview): string | null => {
  const jsonCallbackUrl = callbackUrlFromObject(preview.json);
  if (jsonCallbackUrl) return jsonCallbackUrl;
  return callbackUrlFromObject(preview.fields ?? {});
};

const inspectExternalBodyPreview = (preview: unknown): { error: string; reason: string } | null => {
  const body = preview && typeof preview === "object" ? preview as BodyPreview : { json: preview };
  const fieldNames = body.fields ? Object.keys(body.fields) : [];
  const forbiddenField = fieldNames.find((key) => forbiddenKeySet.has(key));
  if (forbiddenField) {
    return { error: "forbidden_external_request_key", reason: forbiddenField };
  }
  const values = [body.json, body.fields];
  for (const value of values) {
    const parsed = value && typeof value === "object" && "mission" in value
      ? { ...value, mission: parseJsonText((value as { mission?: unknown }).mission) }
      : value;
    const forbiddenKey = hasForbiddenKey(parsed);
    if (forbiddenKey) {
      return { error: "forbidden_external_request_key", reason: forbiddenKey };
    }
  }
  const callbackUrl = readCallbackUrl(body);
  if (callbackUrl) {
    const allowedBases = splitCsv(process.env.GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS);
    if (!allowedBases.some((baseUrl) => callbackUrl.startsWith(baseUrl))) {
      return { error: "callback_url_not_allowed", reason: "callback_url_not_allowed" };
    }
  }
  return null;
};

const block = (
  statusCode: 403 | 404 | 405,
  error: string,
  reason: string,
  corsHeaders: Record<string, string>,
): WorkbenchApiBoundaryDecision => ({
  kind: "blocked",
  statusCode,
  error,
  reason,
  corsHeaders,
});

const decideLocalWorkbenchApiBoundary = (input: {
  corsHeaders: Record<string, string>;
  originCategory: "local-ui";
  routeRule: WorkbenchApiRouteRule;
}): WorkbenchApiBoundaryDecision => input.routeRule.localUiAllowed
  ? { kind: "allowed", corsHeaders: input.corsHeaders, routeRule: input.routeRule, originCategory: input.originCategory }
  : block(403, "route_not_local_allowed", "route_not_local_allowed", input.corsHeaders);

const decideLocalExtensionWorkbenchApiBoundary = (input: {
  corsHeaders: Record<string, string>;
  originCategory: "local-extension";
  routeRule: WorkbenchApiRouteRule;
}): WorkbenchApiBoundaryDecision => input.routeRule.localExtensionAllowed === true
  ? { kind: "allowed", corsHeaders: input.corsHeaders, routeRule: input.routeRule, originCategory: input.originCategory }
  : block(403, "route_not_extension_allowed", "route_not_extension_allowed", input.corsHeaders);

type ExternalWorkbenchApiBoundaryInput = {
  bodyPreview?: unknown;
  corsHeaders: Record<string, string>;
  headers: IncomingHttpHeaders;
  origin: string | undefined;
  originCategory: "external-website";
  routeRule: WorkbenchApiRouteRule;
};

const inspectExternalAvailability = (input: ExternalWorkbenchApiBoundaryInput): WorkbenchApiBoundaryDecision | null => {
  const externalEnabled = process.env.GRASSEYE_EXTERNAL_API_ENABLED === "true";
  const allowedOrigins = splitCsv(process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS);
  if (!externalEnabled) return block(403, "external_api_disabled", "external_api_disabled", input.corsHeaders);
  if (!input.origin || !allowedOrigins.some((allowedOrigin) => allowedOrigin === input.origin)) {
    return block(403, "origin_not_allowed", "origin_not_allowed", buildCorsHeaders(undefined));
  }
  if (!input.routeRule.externalApiAllowed) {
    return block(403, "route_not_external_allowed", "route_not_external_allowed", input.corsHeaders);
  }
  return null;
};

const inspectExternalAuthHeaders = (input: ExternalWorkbenchApiBoundaryInput): WorkbenchApiBoundaryDecision | null => {
  const sourceSystem = readHeader(input.headers, "x-grasseye-source-system");
  if (!sourceSystem) {
    return block(403, "missing_source_system", "missing_source_system", input.corsHeaders);
  }
  const requestId = readHeader(input.headers, "x-grasseye-request-id");
  if (!requestId) {
    return block(403, "missing_request_id", "missing_request_id", input.corsHeaders);
  }
  if (!input.routeRule.requiresSiteHmac) return null;
  const signature = readHeader(input.headers, "x-grasseye-signature");
  if (!signature) return block(403, "missing_site_hmac", "missing_site_hmac", input.corsHeaders);
  let siteSecrets: Record<string, unknown>;
  try {
    const parsed = JSON.parse(process.env.GRASSEYE_EXTERNAL_SITE_HMAC_SECRETS ?? "");
    siteSecrets = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    siteSecrets = {};
  }
  const siteSecret = siteSecrets[sourceSystem];
  if (typeof siteSecret !== "string" || siteSecret.length < 32 || !/^[a-f0-9]{64}$/u.test(signature)) {
    return block(403, "invalid_site_hmac", "invalid_site_hmac", input.corsHeaders);
  }
  const canonicalRequest = [sourceSystem, requestId, input.routeRule.method, input.routeRule.path].join("\n");
  const expected = createHmac("sha256", siteSecret).update(canonicalRequest).digest();
  const actual = Buffer.from(signature, "hex");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return block(403, "invalid_site_hmac", "invalid_site_hmac", input.corsHeaders);
  }
  return null;
};

const allowExternal = (input: ExternalWorkbenchApiBoundaryInput): WorkbenchApiBoundaryDecision => ({
  kind: "allowed",
  corsHeaders: input.corsHeaders,
  routeRule: input.routeRule,
  originCategory: input.originCategory,
});

const decideExternalWorkbenchApiBoundary = (input: ExternalWorkbenchApiBoundaryInput): WorkbenchApiBoundaryDecision => {
  const boundaryFailure = inspectExternalAvailability(input) ?? inspectExternalAuthHeaders(input);
  if (boundaryFailure) return boundaryFailure;
  if (input.bodyPreview === undefined) return allowExternal(input);
  const bodyFailure = inspectExternalBodyPreview(input.bodyPreview);
  return bodyFailure
    ? block(403, bodyFailure.error, bodyFailure.reason, input.corsHeaders)
    : allowExternal(input);
};

export function handleWorkbenchApiBoundary(input: {
  method: string | undefined;
  path: string;
  origin: string | undefined;
  headers: IncomingHttpHeaders;
  baseUrl: string;
  bodyPreview?: unknown;
}): WorkbenchApiBoundaryDecision {
  if (!input.path.startsWith("/api/")) {
    return { kind: "not_api_request" };
  }
  const originCategory = readOriginCategory(input.origin, input.baseUrl, input.headers);
  const responseOrigin = originCategory === "local-extension"
    ? GRASSEYE_BROWSER_EXTENSION_ORIGIN
    : input.origin ?? input.baseUrl;
  const corsHeaders = originCategory === "blocked"
    ? buildCorsHeaders(undefined)
    : buildCorsHeaders(responseOrigin, originCategory === "local-extension" ? "GET,OPTIONS" : undefined);
  if (originCategory === "blocked") {
    return block(403, "origin_not_allowed", "origin_not_allowed", corsHeaders);
  }
  const methodAllowed = input.method === "GET" || input.method === "POST" || input.method === "DELETE";
  if (!methodAllowed) {
    return block(405, "method_not_allowed", "method_not_allowed", corsHeaders);
  }
  const routeRule = matchRouteRule(input.method, input.path);
  if (!routeRule) {
    return block(404, "api_route_not_allowed", "api_route_not_allowed", corsHeaders);
  }
  if (originCategory === "local-ui") {
    return decideLocalWorkbenchApiBoundary({ corsHeaders, originCategory, routeRule });
  }
  if (originCategory === "local-extension") {
    return decideLocalExtensionWorkbenchApiBoundary({ corsHeaders, originCategory, routeRule });
  }
  return decideExternalWorkbenchApiBoundary({
    bodyPreview: input.bodyPreview,
    corsHeaders,
    headers: input.headers,
    origin: input.origin,
    originCategory,
    routeRule,
  });
}
