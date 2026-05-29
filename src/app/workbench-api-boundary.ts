import type { IncomingHttpHeaders } from "node:http";

export type WorkbenchApiRouteRule = {
  method: "GET" | "POST" | "DELETE";
  pathPattern: "exact" | "prefix";
  path: string;
  localUiAllowed: boolean;
  externalApiAllowed: boolean;
  requiresApiKey: boolean;
  jobOwner?: string;
  purpose: string;
};

export type WorkbenchApiBoundaryDecision =
  | { kind: "not_api_request" }
  | {
      kind: "allowed";
      corsHeaders: Record<string, string>;
      routeRule: WorkbenchApiRouteRule;
      originCategory: "local-ui" | "external-website";
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
  { method: "GET", pathPattern: "exact", path: "/api/health", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, purpose: "workbench_health" },
  { method: "GET", pathPattern: "exact", path: "/api/mode", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, purpose: "workbench_mode" },
  { method: "POST", pathPattern: "exact", path: "/api/plugins/amazon-invoice-upload/start", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_invoice_upload_task_start" },
  { method: "GET", pathPattern: "prefix", path: "/api/plugins/amazon-invoice-upload/status/", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_invoice_upload_task_status" },
  { method: "GET", pathPattern: "exact", path: "/api/plugins/amazon-invoice-upload/latest", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_invoice_upload_task_latest" },
  { method: "GET", pathPattern: "exact", path: "/api/plugins/amazon-invoice-upload/ledger", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_invoice_upload_ledger" },
  { method: "POST", pathPattern: "exact", path: "/api/plugins/amazon-invoice-upload/download/start", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_tax_invoice_download_task_start" },
  { method: "GET", pathPattern: "prefix", path: "/api/plugins/amazon-invoice-upload/download/status/", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_tax_invoice_download_task_status" },
  { method: "GET", pathPattern: "exact", path: "/api/plugins/amazon-invoice-upload/download/latest", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_tax_invoice_download_task_latest" },
  { method: "GET", pathPattern: "prefix", path: "/api/plugins/amazon-invoice-upload/download/artifact/", localUiAllowed: true, externalApiAllowed: true, requiresApiKey: true, jobOwner: "amazon-invoice-upload", purpose: "external_amazon_tax_invoice_download_artifact_metadata" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-invoice-upload/mission", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-invoice-upload", purpose: "local_amazon_invoice_upload_mission" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-invoice-upload/task", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-invoice-upload", purpose: "local_amazon_invoice_upload_task_start" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-invoice-upload/task/resume", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-invoice-upload", purpose: "local_amazon_invoice_upload_task_resume" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-invoice-upload/task", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-invoice-upload", purpose: "local_amazon_invoice_upload_task_status" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-invoice-upload/latest", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-invoice-upload", purpose: "local_amazon_invoice_upload_latest" },
  { method: "POST", pathPattern: "exact", path: "/api/deep-research-analysis/start", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_start" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/job", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_job" },
  { method: "DELETE", pathPattern: "exact", path: "/api/deep-research-analysis/job", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_delete" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/history", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_history" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/report", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_report" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/latest", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_latest" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/timeline", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_timeline" },
  { method: "GET", pathPattern: "exact", path: "/api/deep-research-analysis/export", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "deep-research-analysis", purpose: "local_deep_research_export" },
  { method: "POST", pathPattern: "exact", path: "/api/facebook-product-video-mining/mission", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "facebook-product-video-mining", purpose: "local_facebook_mining_mission" },
  { method: "GET", pathPattern: "exact", path: "/api/facebook-product-video-mining/run", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "facebook-product-video-mining", purpose: "local_facebook_mining_run" },
  { method: "GET", pathPattern: "exact", path: "/api/facebook-product-video-mining/latest", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "facebook-product-video-mining", purpose: "local_facebook_mining_latest" },
  { method: "GET", pathPattern: "exact", path: "/api/facebook-product-video-mining/results", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "facebook-product-video-mining", purpose: "local_facebook_mining_results" },
  { method: "GET", pathPattern: "exact", path: "/api/facebook-product-video-mining/export", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "facebook-product-video-mining", purpose: "local_facebook_mining_export" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-product-mining/mission", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_mission" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-product-mining/run", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_run" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-product-mining/latest", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_latest" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-product-mining/keyword-reviews", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_keyword_reviews" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-product-mining/keyword-review", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_keyword_review" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-product-mining/keyword-review/manual-ingest", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_manual_ingest" },
  { method: "GET", pathPattern: "exact", path: "/api/amazon-product-mining/export", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_export" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-product-mining/pause", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_pause" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-product-mining/continue", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_continue" },
  { method: "POST", pathPattern: "exact", path: "/api/amazon-product-mining/terminate", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "amazon-product-mining", purpose: "local_amazon_product_mining_terminate" },
  { method: "GET", pathPattern: "exact", path: "/api/video-download/source-page", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "video-download", purpose: "local_video_download_source_page" },
  { method: "POST", pathPattern: "exact", path: "/api/video-download/start", localUiAllowed: true, externalApiAllowed: false, requiresApiKey: false, jobOwner: "video-download", purpose: "local_video_download_start" },
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

const buildCorsHeaders = (origin: string | undefined): Record<string, string> => ({
  ...(origin ? { "access-control-allow-origin": origin } : {}),
  "access-control-allow-headers": "content-type,x-grasseye-agent-key,x-grasseye-source-system,x-grasseye-request-id",
  "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
  "vary": "Origin",
});

const getLocalOrigins = (baseUrl: string): Set<string> => {
  const url = new URL(baseUrl);
  const port = url.port ? `:${url.port}` : "";
  return new Set([url.origin, `http://127.0.0.1${port}`, `http://localhost${port}`]);
};

const readOriginCategory = (origin: string | undefined, baseUrl: string): "local-ui" | "external-website" | "blocked" => {
  if (!origin) {
    return "local-ui";
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

const decideExternalWorkbenchApiBoundary = (input: {
  bodyPreview?: unknown;
  corsHeaders: Record<string, string>;
  headers: IncomingHttpHeaders;
  origin: string | undefined;
  originCategory: "external-website";
  routeRule: WorkbenchApiRouteRule;
}): WorkbenchApiBoundaryDecision => {
  const externalEnabled = process.env.GRASSEYE_EXTERNAL_API_ENABLED === "true";
  const allowedOrigins = splitCsv(process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS);
  const apiKey = process.env.GRASSEYE_EXTERNAL_API_KEY ?? "";
  if (!externalEnabled) return block(403, "external_api_disabled", "external_api_disabled", input.corsHeaders);
  if (!input.origin || !allowedOrigins.some((allowedOrigin) => allowedOrigin === input.origin)) {
    return block(403, "origin_not_allowed", "origin_not_allowed", buildCorsHeaders(undefined));
  }
  if (!input.routeRule.externalApiAllowed) {
    return block(403, "route_not_external_allowed", "route_not_external_allowed", input.corsHeaders);
  }
  const requestKey = readHeader(input.headers, "x-grasseye-agent-key");
  if (input.routeRule.requiresApiKey && !requestKey) return block(403, "missing_api_key", "missing_api_key", input.corsHeaders);
  if (input.routeRule.requiresApiKey && (apiKey.length === 0 || requestKey !== apiKey)) {
    return block(403, "invalid_api_key", "invalid_api_key", input.corsHeaders);
  }
  if (input.bodyPreview === undefined) return { kind: "allowed", corsHeaders: input.corsHeaders, routeRule: input.routeRule, originCategory: input.originCategory };
  const bodyFailure = inspectExternalBodyPreview(input.bodyPreview);
  return bodyFailure
    ? block(403, bodyFailure.error, bodyFailure.reason, input.corsHeaders)
    : { kind: "allowed", corsHeaders: input.corsHeaders, routeRule: input.routeRule, originCategory: input.originCategory };
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
  const originCategory = readOriginCategory(input.origin, input.baseUrl);
  const corsHeaders = originCategory === "blocked" ? buildCorsHeaders(undefined) : buildCorsHeaders(input.origin ?? input.baseUrl);
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
  return decideExternalWorkbenchApiBoundary({
    bodyPreview: input.bodyPreview,
    corsHeaders,
    headers: input.headers,
    origin: input.origin,
    originCategory,
    routeRule,
  });
}
